import { useEffect, useMemo, useRef, useState } from 'react';
import PortalLayout from '@/components/PortalLayout';
import { WARDEN_LINKS } from '@/components/navLinks';
import { Badge, Modal, Spinner, fileToBase64, FullscreenLoader } from '@/components/ui';
import { useAuthGuard, apiFetch } from '@/lib/useAuthGuard';
import {
  downloadStudentsTemplate,
  parseStudentsFile,
  exportStudentsToExcel,
} from '@/lib/excel';
import {
  FileDown,
  FileUp,
  FileSpreadsheet,
  UserPlus,
  CheckCircle2,
  XCircle,
  Building2,
} from 'lucide-react';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  roll_number: '',
  course: '',
  year: '',
  gender: '',
  dob: '',
  address: '',
  guardian_name: '',
  guardian_phone: '',
  emergency_contact: '',
  room_id: '',
  image: '',
};

export default function WardenStudents() {
  const { user, loading } = useAuthGuard(['warden'], '/warden/login');

  const [students, setStudents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [myHostels, setMyHostels] = useState([]); // hostel blocks/buildings this warden is responsible for
  const [hostelScope, setHostelScope] = useState('all'); // 'all' or a specific hostel id
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [blockFilter, setBlockFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [allocationId, setAllocationId] = useState(null);

  // Add-student modal (Add only - no edit/delete for warden)
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  // Bulk excel import
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [importErr, setImportErr] = useState('');
  const fileInputRef = useRef(null);

  const fetchAll = async (scopeOverride) => {
    try {
      setErr('');

      // The admin is the source of truth for which hostel block(s)/building(s)
      // this warden manages - the backend derives it from the logged-in
      // user, never from anything the client sends. `hostel_id` here is
      // only used to narrow down to a single block when the warden manages
      // more than one and has picked one from the switcher below.
      const scope = scopeOverride ?? hostelScope;
      const studentsUrl =
        scope && scope !== 'all'
          ? `/api/warden/students?hostel_id=${encodeURIComponent(scope)}`
          : '/api/warden/students';

      const [studentsData, metaData, hostelsData] = await Promise.all([
        apiFetch(studentsUrl),
        apiFetch('/api/admin/meta'),
        apiFetch('/api/warden/my-hostels'),
      ]);

      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setRooms(Array.isArray(metaData?.rooms) ? metaData.rooms : []);
      setMyHostels(Array.isArray(hostelsData?.hostels) ? hostelsData.hostels : []);
    } catch (error) {
      console.error('Error loading students:', error);
      setErr(error.message || 'Failed to load students');
      setStudents([]);
      setRooms([]);
      setMyHostels([]);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleHostelScopeChange = async (nextScope) => {
    setHostelScope(nextScope);
    setRefreshing(true);
    await fetchAll(nextScope);
    setRefreshing(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  /*
    Safely convert any value into text.
   */
  const getText = (value) => {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  };

  const getStudentId = (student) => student.id || student._id;

  const getStudentDate = (student) => {
    const dateValue =
      student.created_at ||
      student.createdAt ||
      student.registered_at ||
      student.registeredAt ||
      student.admission_date ||
      student.admissionDate ||
      student.joined_at ||
      student.joinedAt ||
      student.updated_at ||
      student.updatedAt;

    if (!dateValue) {
      return 0;
    }

    const timestamp = new Date(dateValue).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  const getStudentName = (student) => getText(student.name).toLowerCase();

  const getRollNumber = (student) =>
    getText(student.roll_number || student.rollNumber).toLowerCase();

  const getCourse = (student) => getText(student.course);

  const getStatus = (student) => getText(student.status) || 'Unknown';

  const getStudentRoomId = (student) => {
    if (student.room_id) return String(student.room_id);
    if (student.roomId) return String(student.roomId);
    if (student.room?.id) return String(student.room.id);
    return '';
  };

  const getBlock = (student) => getText(student.block);

  const getRoomNumber = (student) =>
    getText(student.room_number || student.roomNumber);

  const getRoomId = (room) => String(room.id || room._id || '');
  const getRoomLabel = (room) => getText(room.room_number || room.roomNumber || room.number);
  const getRoomBlock = (room) => getText(room.block || room.block_name);
  const getRoomOccupied = (room) => Number(room.occupied || 0);
  const getRoomCapacity = (room) => Number(room.capacity || 0);

  const statuses = useMemo(() => {
    return [...new Set(students.map((student) => getStatus(student)).filter(Boolean))].sort();
  }, [students]);

  const courses = useMemo(() => {
    return [
      ...new Set(students.map((student) => getCourse(student)).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
  }, [students]);

  const blocks = useMemo(() => {
    return [
      ...new Set(students.map((student) => getBlock(student)).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
  }, [students]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = students.filter((student) => {
      const name = getStudentName(student);
      const rollNumber = getRollNumber(student);
      const phone = getText(student.phone).toLowerCase();
      const email = getText(student.email).toLowerCase();
      const course = getCourse(student).toLowerCase();
      const block = getBlock(student).toLowerCase();
      const roomNumber = getRoomNumber(student).toLowerCase();
      const status = getStatus(student).toLowerCase();

      const matchesSearch =
        !query ||
        name.includes(query) ||
        rollNumber.includes(query) ||
        phone.includes(query) ||
        email.includes(query) ||
        course.includes(query) ||
        block.includes(query) ||
        roomNumber.includes(query);

      const matchesStatus = statusFilter === 'all' || getStatus(student) === statusFilter;
      const matchesCourse = courseFilter === 'all' || getCourse(student) === courseFilter;
      const matchesBlock = blockFilter === 'all' || getBlock(student) === blockFilter;

      const hasRoom = Boolean(getRoomNumber(student));
      const matchesRoom =
        roomFilter === 'all' ||
        (roomFilter === 'assigned' && hasRoom) ||
        (roomFilter === 'unassigned' && !hasRoom);

      return matchesSearch && matchesStatus && matchesCourse && matchesBlock && matchesRoom;
    });

    return [...result].sort((first, second) => {
      switch (sortBy) {
        case 'name_asc':
          return getStudentName(first).localeCompare(getStudentName(second));
        case 'name_desc':
          return getStudentName(second).localeCompare(getStudentName(first));
        case 'roll_asc':
          return getRollNumber(first).localeCompare(getRollNumber(second), undefined, { numeric: true });
        case 'roll_desc':
          return getRollNumber(second).localeCompare(getRollNumber(first), undefined, { numeric: true });
        case 'room_asc':
          return getRoomNumber(first).localeCompare(getRoomNumber(second), undefined, { numeric: true });
        case 'room_desc':
          return getRoomNumber(second).localeCompare(getRoomNumber(first), undefined, { numeric: true });
        case 'oldest':
          return getStudentDate(first) - getStudentDate(second);
        case 'latest':
        default:
          return getStudentDate(second) - getStudentDate(first);
      }
    });
  }, [students, search, statusFilter, courseFilter, blockFilter, roomFilter, sortBy]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCourseFilter('all');
    setBlockFilter('all');
    setRoomFilter('all');
    setSortBy('latest');
  };

  /* ---------------- Add student (warden: add only) ---------------- */

  const openAdd = () => {
    setForm({ ...emptyForm });
    setFormErr('');
    setModalOpen(true);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await fileToBase64(file);
      setForm((current) => ({ ...current, image: base64 }));
    } catch (error) {
      setFormErr('Failed to read selected file');
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormErr('');

    try {
      // Optionally, you can force hostel_id here if your API supports it:
      // const payload = { ...form, hostel_id: user.hostel_id };
      await apiFetch('/api/admin/students', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      setModalOpen(false);
      await fetchAll();
    } catch (error) {
      console.error('Error adding student:', error);
      setFormErr(error.message || 'Failed to add student');
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- Room assignment / check-out ---------------- */

  const handleAllocate = async (student, selectedRoomId) => {
    const studentId = getStudentId(student);
    const newRoomId = String(selectedRoomId || '');

    if (!studentId) {
      setErr('Student ID is missing');
      return;
    }

    setAllocationId(studentId);
    setErr('');

    const previousStudents = students;

    setStudents((current) =>
      current.map((item) =>
        String(getStudentId(item)) === String(studentId)
          ? { ...item, room_id: newRoomId || null }
          : item
      )
    );

    try {
      if (newRoomId) {
        await apiFetch(`/api/admin/students/${studentId}/allocate`, {
          method: 'POST',
          body: JSON.stringify({ room_id: newRoomId }),
        });
      } else {
        await apiFetch(`/api/admin/students/${studentId}/allocate`, {
          method: 'POST',
          body: JSON.stringify({ checkout: true, room_id: null }),
        });
      }

      await fetchAll();
    } catch (error) {
      console.error('Error allocating room:', error);
      setStudents(previousStudents);
      setErr(error.message || 'Failed to update room');
    } finally {
      setAllocationId(null);
    }
  };

  const handleCheckout = async (student) => {
    const studentId = getStudentId(student);
    if (!studentId) return;

    if (!window.confirm(`Check out ${student.name}?`)) return;

    setAllocationId(studentId);
    setErr('');

    try {
      await apiFetch(`/api/admin/students/${studentId}/allocate`, {
        method: 'POST',
        body: JSON.stringify({ checkout: true, room_id: null }),
      });

      await fetchAll();
    } catch (error) {
      console.error('Error checking out student:', error);
      setErr(error.message || 'Failed to check out student');
    } finally {
      setAllocationId(null);
    }
  };

  /* ---------------- Bulk excel import / export ---------------- */

  const openImport = () => {
    setImportRows([]);
    setImportResults(null);
    setImportErr('');
    setImportFileName('');
    setImportOpen(true);
  };

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportErr('');
    setImportResults(null);
    setImportFileName(file.name);

    try {
      const rows = await parseStudentsFile(file);
      if (rows.length === 0) {
        setImportErr('No rows found in that file.');
        setImportRows([]);
        return;
      }
      setImportRows(rows);
    } catch (error) {
      console.error('Error parsing file:', error);
      setImportErr('Could not read that file. Please use the provided template.');
      setImportRows([]);
    }
  };

  const runImport = async () => {
    if (importRows.length === 0) return;

    setImporting(true);
    setImportErr('');

    try {
      const response = await apiFetch('/api/admin/students/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ rows: importRows }),
      });

      setImportResults(response);
      await fetchAll();
    } catch (error) {
      console.error('Error importing students:', error);
      setImportErr(error.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleExport = () => {
    exportStudentsToExcel(filteredStudents, 'warden_students_export.xlsx');
  };

  const getStatusColor = (status) => {
    if (status === 'Active') return 'green';
    if (status === 'CheckedOut') return 'gray';
    return 'red';
  };

  if (loading || !user) {
    return <FullscreenLoader />;
  }

  return (
    <PortalLayout role="warden" user={user} links={WARDEN_LINKS} title="Students">
      <div className="space-y-5">
        {/* Page heading */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Student Directory</h2>
            <p className="mt-1 text-sm text-gray-500">
              Search, filter, add students, and manage room allocations.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>

            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <FileDown size={16} /> Export
            </button>

            <button
              type="button"
              onClick={openImport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <FileUp size={16} /> Import
            </button>

            <button
              type="button"
              className="btn-primary inline-flex items-center gap-1.5"
              onClick={openAdd}
            >
              <UserPlus size={16} /> Add Student
            </button>
          </div>
        </div>

        {/* My blocks / buildings - which hostel(s) this warden is responsible for */}
        {myHostels.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700 animate-fade-in-up">
            <Building2 size={18} className="mt-0.5 shrink-0" />
            <p>
              You haven't been assigned to any hostel block yet. Ask an admin to assign you
              to a block under <span className="font-medium">Staff &amp; Wardens</span> — once
              assigned, that block's students will show up here.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <Building2 size={14} /> My Block{myHostels.length > 1 ? 's' : ''}
            </span>

            {myHostels.length > 1 && (
              <button
                type="button"
                onClick={() => handleHostelScopeChange('all')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  hostelScope === 'all'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All my blocks
              </button>
            )}

            {myHostels.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => handleHostelScopeChange(String(h.id))}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  hostelScope === String(h.id)
                    ? 'bg-emerald-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {h.name}
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="student-search" className="mb-1 block text-xs font-medium text-gray-500">
                Search
              </label>
              <input
                id="student-search"
                type="search"
                className="input w-full"
                placeholder="Name, roll no, phone..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div>
              <label htmlFor="student-status" className="mb-1 block text-xs font-medium text-gray-500">
                Status
              </label>
              <select
                id="student-status"
                className="input w-full"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="student-course" className="mb-1 block text-xs font-medium text-gray-500">
                Course
              </label>
              <select
                id="student-course"
                className="input w-full"
                value={courseFilter}
                onChange={(event) => setCourseFilter(event.target.value)}
              >
                <option value="all">All courses</option>
                {courses.map((course) => (
                  <option key={course} value={course}>{course}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="student-sort" className="mb-1 block text-xs font-medium text-gray-500">
                Sort by
              </label>
              <select
                id="student-sort"
                className="input w-full"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="latest">Latest added</option>
                <option value="oldest">Oldest added</option>
                <option value="name_asc">Name: A–Z</option>
                <option value="name_desc">Name: Z–A</option>
                <option value="roll_asc">Roll number: Low–High</option>
                <option value="roll_desc">Roll number: High–Low</option>
                <option value="room_asc">Room: Low–High</option>
                <option value="room_desc">Room: High–Low</option>
              </select>
            </div>

            <div>
              <label htmlFor="student-block" className="mb-1 block text-xs font-medium text-gray-500">
                Block
              </label>
              <select
                id="student-block"
                className="input w-full"
                value={blockFilter}
                onChange={(event) => setBlockFilter(event.target.value)}
              >
                <option value="all">All blocks</option>
                {blocks.map((block) => (
                  <option key={block} value={block}>{block}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="student-room" className="mb-1 block text-xs font-medium text-gray-500">
                Room assignment
              </label>
              <select
                id="student-room"
                className="input w-full"
                value={roomFilter}
                onChange={(event) => setRoomFilter(event.target.value)}
              >
                <option value="all">All students</option>
                <option value="assigned">Assigned room</option>
                <option value="unassigned">Unassigned room</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
              >
                Clear filters
              </button>
            </div>
          </div>
        </div>

        {err && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 animate-fade-in-up">
            {err}
          </div>
        )}

        {/* Result count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing{' '}
            <span className="font-semibold text-gray-700">{filteredStudents.length}</span> of{' '}
            <span className="font-semibold text-gray-700">{students.length}</span> students
          </p>
        </div>

        {/* Table */}
        <div className="table-wrap overflow-x-auto">
          <table className="data min-w-[1050px]">
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll No</th>
                <th>Hostel</th>
                <th>Room</th>
                <th>Course</th>
                <th>Status</th>
                <th>Contact</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredStudents.map((student, i) => {
                const studentId = getStudentId(student);
                const currentRoomId = getStudentRoomId(student);
                const isAllocating = allocationId === studentId;
                const status = getStatus(student);

                return (
                  <tr
                    key={studentId}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                  >
                    <td>
                      <div className="font-medium text-gray-800">
                        {student.name || 'Unnamed student'}
                      </div>
                      {student.email && (
                        <div className="text-xs text-gray-400">{student.email}</div>
                      )}
                    </td>

                    <td>{student.roll_number || student.rollNumber || '—'}</td>

                    <td className="text-xs text-gray-600">{student.hostel_name || '—'}</td>

                    <td>
                      <select
                        className="input py-1 text-xs"
                        value={currentRoomId}
                        disabled={isAllocating}
                        onChange={(event) => handleAllocate(student, event.target.value)}
                      >
                        <option value="">Unassigned</option>

                        {rooms.map((room) => {
                          const roomId = getRoomId(room);
                          const occupied = getRoomOccupied(room);
                          const capacity = getRoomCapacity(room);
                          const isCurrentRoom = roomId === currentRoomId;
                          const isFull = capacity > 0 && occupied >= capacity && !isCurrentRoom;

                          return (
                            <option key={roomId} value={roomId} disabled={isFull}>
                              {getRoomBlock(room) ? `${getRoomBlock(room)} - ` : ''}
                              {getRoomLabel(room)} ({occupied}/{capacity})
                              {isFull ? ' - Full' : ''}
                            </option>
                          );
                        })}
                      </select>

                      {isAllocating && (
                        <p className="mt-1 text-xs text-gray-400 animate-pulse">Updating room...</p>
                      )}
                    </td>

                    <td>{student.course || '—'}</td>

                    <td>
                      <Badge color={getStatusColor(status)}>{status}</Badge>
                    </td>

                    <td className="text-xs text-gray-500">{student.phone || '—'}</td>

                    <td className="whitespace-nowrap text-right">
                      {status === 'Active' && (
                        <button
                          type="button"
                          className="text-xs text-amber-600 hover:underline"
                          onClick={() => handleCheckout(student)}
                        >
                          Check-out
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    No students found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add student modal (warden: add only, no edit/delete) */}
      <Modal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title="Add Student" 
        wide
        className="z-[9999]"
        overlayClassName="z-[9999]"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-400">
              {form.image ? (
                <img src={form.image} alt="" className="h-full w-full object-cover" />
              ) : (
                'Photo'
              )}
            </div>
            <div>
              <label className="label">Profile Photo</label>
              <input type="file" accept="image/*" onChange={handleImage} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Full Name</label>
              <input required name="name" className="input" value={form.name} onChange={handleInputChange} />
            </div>
            <div>
              <label className="label">Roll Number</label>
              <input name="roll_number" className="input" value={form.roll_number} onChange={handleInputChange} />
            </div>
            <div>
              <label className="label">Email</label>
              <input required name="email" type="email" className="input" value={form.email} onChange={handleInputChange} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input name="phone" className="input" value={form.phone} onChange={handleInputChange} />
            </div>
            <div>
              <label className="label">Password</label>
              <input required name="password" type="password" className="input" value={form.password} onChange={handleInputChange} />
            </div>
            <div>
              <label className="label">Course</label>
              <input name="course" className="input" value={form.course} onChange={handleInputChange} />
            </div>
            <div>
              <label className="label">Year</label>
              <input name="year" className="input" value={form.year} onChange={handleInputChange} />
            </div>
            <div>
              <label className="label">Gender</label>
              <select name="gender" className="input" value={form.gender} onChange={handleInputChange}>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <input name="dob" type="date" className="input" value={form.dob ? String(form.dob).slice(0, 10) : ''} onChange={handleInputChange} />
            </div>
            <div>
              <label className="label">Guardian Name</label>
              <input name="guardian_name" className="input" value={form.guardian_name} onChange={handleInputChange} />
            </div>
            <div>
              <label className="label">Guardian Phone</label>
              <input name="guardian_phone" className="input" value={form.guardian_phone} onChange={handleInputChange} />
            </div>
            <div>
              <label className="label">Emergency Contact</label>
              <input name="emergency_contact" className="input" value={form.emergency_contact} onChange={handleInputChange} />
            </div>
            <div>
              <label className="label">Initial Room</label>
              <select name="room_id" className="input" value={form.room_id} onChange={handleInputChange}>
                <option value="">Unassigned</option>
                {rooms.map((room) => {
                  const roomId = getRoomId(room);
                  const occupied = getRoomOccupied(room);
                  const capacity = getRoomCapacity(room);
                  const isFull = capacity > 0 && occupied >= capacity;

                  return (
                    <option key={roomId} value={roomId} disabled={isFull}>
                      {getRoomBlock(room) ? `${getRoomBlock(room)} - ` : ''}
                      {getRoomLabel(room)} ({occupied}/{capacity})
                      {isFull ? ' - Full' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Address</label>
            <textarea name="address" className="input" rows={2} value={form.address} onChange={handleInputChange} />
          </div>

          {formErr && <p className="text-sm text-red-600 animate-slide-down">{formErr}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-outline" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60">
              {saving && <Spinner />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk import modal */}
      <Modal 
        open={importOpen} 
        onClose={() => setImportOpen(false)} 
        title="Bulk Import Students" 
        wide
        className="z-[9999]"
        overlayClassName="z-[9999]"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileSpreadsheet size={18} className="text-primary-600" />
              Need the column layout? Download the sample first.
            </div>
            <button
              type="button"
              onClick={downloadStudentsTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
            >
              <FileDown size={14} /> Download template
            </button>
          </div>

          <div>
            <label className="label">Excel file (.xlsx)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportFileChange}
            />
            {importFileName && (
              <p className="mt-1 text-xs text-gray-400">
                {importRows.length} row{importRows.length === 1 ? '' : 's'} detected in {importFileName}
              </p>
            )}
          </div>

          {importErr && <p className="text-sm text-red-600 animate-slide-down">{importErr}</p>}

          {importResults && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-100">
              <div className="flex items-center gap-4 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-600">
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 size={14} /> {importResults.createdCount} created
                </span>
                {importResults.failedCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-red-600">
                    <XCircle size={14} /> {importResults.failedCount} failed
                  </span>
                )}
              </div>
              <ul className="divide-y divide-gray-100 text-xs">
                {importResults.results.map((r) => (
                  <li key={r.row} className="flex items-center justify-between gap-2 px-4 py-2">
                    <span className="text-gray-600 truncate">
                      Row {r.row} — {r.name || r.email || 'Unnamed'}
                    </span>
                    {r.success ? (
                      <span className="text-emerald-600">Added</span>
                    ) : (
                      <span className="text-red-600">{r.error}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-outline" onClick={() => setImportOpen(false)}>
              Close
            </button>
            <button
              type="button"
              disabled={importRows.length === 0 || importing}
              onClick={runImport}
              className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importing && <Spinner />}
              {importing ? 'Importing...' : `Import ${importRows.length || ''} row${importRows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </Modal>
    </PortalLayout>
  );
}