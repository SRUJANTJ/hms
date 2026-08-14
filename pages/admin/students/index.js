import { useEffect, useMemo, useRef, useState } from 'react';
import PortalLayout from '@/components/PortalLayout';
import { ADMIN_LINKS } from '@/components/navLinks';
import {
  Modal,
  Badge,
  Spinner,
  fileToBase64,
  FullscreenLoader,
} from '@/components/ui';
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
} from 'lucide-react';

const emptyForm = {
    name:"",
    email:"",
    phone:"",
    password:"",
    roll_number:"",
    course:"",
    year:"",
    gender:"",
    dob:"",
    address:"",
    guardian_name:"",
    guardian_phone:"",
    emergency_contact:"",
    hostel_id:"",
    room_id:"",
    image:"",
    id_proof:"",
};

export default function AdminStudents() {
  const { user, loading } = useAuthGuard(
    ['admin'],
    '/admin/login'
  );

  const [students, setStudents] = useState([]);
  const [rooms, setRooms] = useState([]);
const [hostels, setHostels] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allocationId, setAllocationId] = useState(null);

  // Bulk excel import
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [importErr, setImportErr] = useState('');
  const fileInputRef = useRef(null);

  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');

  const [statusFilter, setStatusFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [blockFilter, setBlockFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [sortBy, setSortBy] = useState('latest');

  const getText = (value) => {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  };

  const getStudentId = (student) => {
    return student.id || student._id;
  };

  /*
    Supports both formats:

    student.room_id = "room-id"

    OR:

    student.room = {
      id: "room-id",
      room_number: "101"
    }
  */
  const getStudentRoomId = (student) => {
    if (student.room_id) {
      return String(student.room_id);
    }

    if (student.roomId) {
      return String(student.roomId);
    }

    if (student.room?.id) {
      return String(student.room.id);
    }

    if (student.room?._id) {
      return String(student.room._id);
    }

    return '';
  };

  const getStudentRoomNumber = (student) => {
    if (student.room_number) {
      return getText(student.room_number);
    }

    if (student.roomNumber) {
      return getText(student.roomNumber);
    }

    if (student.room?.room_number) {
      return getText(student.room.room_number);
    }

    if (student.room?.roomNumber) {
      return getText(student.room.roomNumber);
    }

    return '';
  };

  const getStudentBlock = (student) => {
    if (student.block) {
      return getText(student.block);
    }

    if (student.room?.block) {
      return getText(student.room.block);
    }

    return '';
  };

  const getRoomId = (room) => {
    return String(room.id || room._id || '');
  };

  const getRoomNumber = (room) => {
    return getText(
      room.room_number ||
        room.roomNumber ||
        room.number
    );
  };

const getRoomBlock = (room) => {
  return getText(room.block || room.block_name);
};

const getHostelName = (hostelId) => {
  const hostel = hostels.find(
    (h) => Number(h.id) === Number(hostelId)
  );

  return hostel?.name || "";
};

const getRoomOccupied = (room) => {
  return Number(room.occupied || 0);
};
  const getRoomCapacity = (room) => {
    return Number(room.capacity || 0);
  };

  const getStatus = (student) => {
    return getText(student.status) || 'Unknown';
  };

  const getCreatedDate = (student) => {
    const value =
      student.created_at ||
      student.createdAt ||
      student.registered_at ||
      student.registeredAt ||
      student.admission_date ||
      student.admissionDate;

    if (!value) {
      return 0;
    }

    const timestamp = new Date(value).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  const load = async () => {
    setLoadingData(true);
    setErr('');

    try {
      const [studentsData, metaData] =
        await Promise.all([
          apiFetch('/api/admin/students'),
          apiFetch('/api/admin/meta'),
        ]);

      setStudents(
        Array.isArray(studentsData) ? studentsData : []
      );

   setRooms(
  Array.isArray(metaData.rooms)
    ? metaData.rooms
    : []
);

setHostels(
  Array.isArray(metaData.hostels)
    ? metaData.hostels
    : []
);
    } catch (error) {
      console.error('Error loading admin data:', error);
      setErr(error.message || 'Failed to load students');
      setStudents([]);
      setRooms([]);
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      load();
    }
  }, [user]);

  const courses = useMemo(() => {
    return [
      ...new Set(
        students
          .map((student) => getText(student.course))
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [students]);

  const years = useMemo(() => {
    return [
      ...new Set(
        students
          .map((student) => getText(student.year))
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [students]);

  const genders = useMemo(() => {
    return [
      ...new Set(
        students
          .map((student) => getText(student.gender))
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [students]);

  const blocks = useMemo(() => {
    return [
      ...new Set(
        rooms
          .map((room) => getRoomBlock(room))
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [rooms]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = students.filter((student) => {
      const name = getText(student.name).toLowerCase();
      const rollNumber = getText(
        student.roll_number || student.rollNumber
      ).toLowerCase();
      const email = getText(student.email).toLowerCase();
      const phone = getText(student.phone).toLowerCase();
      const course = getText(student.course).toLowerCase();
      const year = getText(student.year).toLowerCase();
      const gender = getText(student.gender).toLowerCase();
      const roomNumber =
        getStudentRoomNumber(student).toLowerCase();
      const block =
        getStudentBlock(student).toLowerCase();

      const status = getStatus(student);
      const roomId = getStudentRoomId(student);

      const matchesSearch =
        !query ||
        name.includes(query) ||
        rollNumber.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        course.includes(query) ||
        roomNumber.includes(query) ||
        block.includes(query);

      const matchesStatus =
        statusFilter === 'all' ||
        status === statusFilter;

      const matchesCourse =
        courseFilter === 'all' ||
        getText(student.course) === courseFilter;

      const matchesYear =
        yearFilter === 'all' ||
        getText(student.year) === yearFilter;

      const matchesGender =
        genderFilter === 'all' ||
        getText(student.gender) === genderFilter;

      const matchesBlock =
        blockFilter === 'all' ||
        getStudentBlock(student) === blockFilter;

      const hasRoom = Boolean(roomId);

      const matchesRoom =
        roomFilter === 'all' ||
        (roomFilter === 'assigned' && hasRoom) ||
        (roomFilter === 'unassigned' && !hasRoom);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCourse &&
        matchesYear &&
        matchesGender &&
        matchesBlock &&
        matchesRoom
      );
    });

    return [...result].sort((first, second) => {
      switch (sortBy) {
        case 'name_asc':
          return getText(first.name).localeCompare(
            getText(second.name)
          );

        case 'name_desc':
          return getText(second.name).localeCompare(
            getText(first.name)
          );

        case 'roll_asc':
          return getText(
            first.roll_number || first.rollNumber
          ).localeCompare(
            getText(
              second.roll_number || second.rollNumber
            ),
            undefined,
            { numeric: true }
          );

        case 'roll_desc':
          return getText(
            second.roll_number || second.rollNumber
          ).localeCompare(
            getText(
              first.roll_number || first.rollNumber
            ),
            undefined,
            { numeric: true }
          );

        case 'room_asc':
          return getStudentRoomNumber(first).localeCompare(
            getStudentRoomNumber(second),
            undefined,
            { numeric: true }
          );

        case 'room_desc':
          return getStudentRoomNumber(second).localeCompare(
            getStudentRoomNumber(first),
            undefined,
            { numeric: true }
          );

        case 'oldest':
          return (
            getCreatedDate(first) -
            getCreatedDate(second)
          );

        case 'latest':
        default:
          return (
            getCreatedDate(second) -
            getCreatedDate(first)
          );
      }
    });
  }, [
    students,
    search,
    statusFilter,
    courseFilter,
    yearFilter,
    genderFilter,
    blockFilter,
    roomFilter,
    sortBy,
  ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCourseFilter('all');
    setYearFilter('all');
    setGenderFilter('all');
    setBlockFilter('all');
    setRoomFilter('all');
    setSortBy('latest');
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setErr('');
    setModalOpen(true);
  };

  const openEdit = (student) => {
    setEditing(student);

setForm({
    ...emptyForm,
    ...student,
    hostel_id: student.hostel_id || "",
    room_id: getStudentRoomId(student),
    password: ""
});

    setErr('');
    setModalOpen(true);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleImage = async (event, field) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const base64 = await fileToBase64(file);

      setForm((currentForm) => ({
        ...currentForm,
        [field]: base64,
      }));
    } catch (error) {
      setErr('Failed to read selected file');
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErr('');

    try {
      if (editing) {
        await apiFetch(
          `/api/admin/students/${getStudentId(editing)}`,
          {
            method: 'PUT',
            body: JSON.stringify(form),
          }
        );
      } else {
        await apiFetch('/api/admin/students', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }

      setModalOpen(false);
      await load();
    } catch (error) {
      console.error('Error saving student:', error);
      setErr(error.message || 'Failed to save student');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (student) => {
    const studentId = getStudentId(student);

    if (!studentId) {
      setErr('Student ID is missing');
      return;
    }

    if (
      !window.confirm(
        `Delete ${student.name}? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await apiFetch(`/api/admin/students/${studentId}`, {
        method: 'DELETE',
      });

      await load();
    } catch (error) {
      console.error('Error deleting student:', error);
      setErr(error.message || 'Failed to delete student');
    }
  };

  /*
    Fixed room allocation.

    1. Updates the select immediately.
    2. Sends room_id to the backend.
    3. Uses checkout:true when Unassigned is selected.
    4. Reloads the server data after success.
    5. Restores the old room if the API request fails.

    Note: hostel_id is derived server-side from the room row
    inside allocate.js — the client never sends hostel_id.
  */
  const handleAllocate = async (student, selectedRoomId) => {
    const studentId = getStudentId(student);
    const oldRoomId = getStudentRoomId(student);
    const newRoomId = String(selectedRoomId || '');

    if (!studentId) {
      setErr('Student ID is missing');
      return;
    }

    setAllocationId(studentId);
    setErr('');

    const previousStudents = students;

    // Optimistic UI update
    setStudents((currentStudents) =>
      currentStudents.map((item) =>
        String(getStudentId(item)) === String(studentId)
          ? {
              ...item,
              room_id: newRoomId || null,
            }
          : item
      )
    );

    try {
      if (newRoomId) {
        await apiFetch(
          `/api/admin/students/${studentId}/allocate`,
          {
            method: 'POST',
            body: JSON.stringify({
              room_id: newRoomId,
            }),
          }
        );
      } else {
        await apiFetch(
          `/api/admin/students/${studentId}/allocate`,
          {
            method: 'POST',
            body: JSON.stringify({
              checkout: true,
              room_id: null,
            }),
          }
        );
      }

      await load();
    } catch (error) {
      console.error('Error allocating room:', error);

      // Roll back UI if API request fails
      setStudents(previousStudents);
      setErr(error.message || 'Failed to update room');
    } finally {
      setAllocationId(null);
    }
  };

  const handleCheckout = async (student) => {
    const studentId = getStudentId(student);

    if (!studentId) {
      setErr('Student ID is missing');
      return;
    }

    if (
      !window.confirm(`Check out ${student.name}?`)
    ) {
      return;
    }

    setAllocationId(studentId);
    setErr('');

    try {
      await apiFetch(
        `/api/admin/students/${studentId}/allocate`,
        {
          method: 'POST',
          body: JSON.stringify({
            checkout: true,
            room_id: null,
          }),
        }
      );

      await load();
    } catch (error) {
      console.error('Error checking out student:', error);
      setErr(error.message || 'Failed to check out student');
    } finally {
      setAllocationId(null);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'Active') return 'green';
    if (status === 'CheckedOut') return 'gray';

    return 'red';
  };

  /* ---------------- Bulk excel import / export ---------------- */

  const openImport = () => {
    setImportRows([]);
    setImportFileName('');
    setImportResults(null);
    setImportErr('');
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
      // Note: bulk-import.js derives hostel_id server-side from
      // each row's room_id — the client only ever sends room_id.
      const response = await apiFetch('/api/admin/students/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ rows: importRows }),
      });

      setImportResults(response);
      await load();
    } catch (error) {
      console.error('Error importing students:', error);
      setImportErr(error.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleExport = () => {
    exportStudentsToExcel(filteredStudents, 'students_export.xlsx');
  };

  if (loading || !user) {
    return <FullscreenLoader />;
  }

  return (
    <PortalLayout
      role="admin"
      user={user}
      links={ADMIN_LINKS}
      title="Students"
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              Student Management
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Add, edit, allocate rooms, and manage students.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loadingData}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing || loadingData
                ? 'Refreshing...'
                : 'Refresh'}
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

        {err && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 animate-fade-in-up">
            {err}
          </div>
        )}

        {/* Filters */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Search
              </label>

              <input
                type="search"
                className="input w-full"
                placeholder="Name, roll no, email..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Status
              </label>

              <select
                className="input w-full"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="all">All statuses</option>
                <option value="Active">Active</option>
                <option value="CheckedOut">
                  Checked out
                </option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Course
              </label>

              <select
                className="input w-full"
                value={courseFilter}
                onChange={(event) =>
                  setCourseFilter(event.target.value)
                }
              >
                <option value="all">All courses</option>

                {courses.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Sort by
              </label>

              <select
                className="input w-full"
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value)
                }
              >
                <option value="latest">
                  Latest added
                </option>
                <option value="oldest">
                  Oldest added
                </option>
                <option value="name_asc">
                  Name: A–Z
                </option>
                <option value="name_desc">
                  Name: Z–A
                </option>
                <option value="roll_asc">
                  Roll: Low–High
                </option>
                <option value="roll_desc">
                  Roll: High–Low
                </option>
                <option value="room_asc">
                  Room: Low–High
                </option>
                <option value="room_desc">
                  Room: High–Low
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Year
              </label>

              <select
                className="input w-full"
                value={yearFilter}
                onChange={(event) =>
                  setYearFilter(event.target.value)
                }
              >
                <option value="all">All years</option>

                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Gender
              </label>

              <select
                className="input w-full"
                value={genderFilter}
                onChange={(event) =>
                  setGenderFilter(event.target.value)
                }
              >
                <option value="all">All genders</option>

                {genders.map((gender) => (
                  <option key={gender} value={gender}>
                    {gender}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Block
              </label>

              <select
                className="input w-full"
                value={blockFilter}
                onChange={(event) =>
                  setBlockFilter(event.target.value)
                }
              >
                <option value="all">All blocks</option>

                {blocks.map((block) => (
                  <option key={block} value={block}>
                    {block}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Room assignment
              </label>

              <select
                className="input w-full"
                value={roomFilter}
                onChange={(event) =>
                  setRoomFilter(event.target.value)
                }
              >
                <option value="all">All students</option>
                <option value="assigned">
                  Assigned room
                </option>
                <option value="unassigned">
                  Unassigned room
                </option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Clear filters
              </button>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-500">
          Showing{' '}
          <span className="font-semibold text-gray-800">
            {filteredStudents.length}
          </span>{' '}
          of{' '}
          <span className="font-semibold text-gray-800">
            {students.length}
          </span>{' '}
          students
        </p>

        {/* Students table */}
        <div className="table-wrap overflow-x-auto">
          <table className="data min-w-[1050px]">
          <thead>
<tr>
  <th>Student</th>
  <th>Roll No</th>
  <th>Course</th>
  <th>Hostel</th>
  <th>Room</th>
  <th>Status</th>
  <th>Contact</th>
  <th className="text-right">Actions</th>
</tr>
</thead>

            <tbody>
              {filteredStudents.map((student, rowIndex) => {
                const studentId = getStudentId(student);
                const currentRoomId =
                  getStudentRoomId(student);
                const isAllocating =
                  allocationId === studentId;

                return (
                  <tr
                    key={studentId}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(rowIndex, 12) * 30}ms` }}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                          {student.image ? (
                            <img
                              src={student.image}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            getText(student.name)
                              .charAt(0)
                              .toUpperCase() || '?'
                          )}
                        </div>

                        <div>
                          <p className="font-medium text-gray-800">
                            {student.name || 'Unnamed student'}
                          </p>

                          <p className="text-xs text-gray-400">
                            {student.email || '—'}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td>
                      {student.roll_number || '—'}
                    </td>

                    <td>
                      {student.course || '—'}
                    </td>

<td>
    {getHostelName(student.hostel_id) || "—"}
</td>
                    <td>
                      <select
                        className="input py-1 text-xs"
                        value={currentRoomId}
                        disabled={isAllocating}
                        onChange={(event) =>
                          handleAllocate(
                            student,
                            event.target.value
                          )
                        }
                      >
                        <option value="">
                          Unassigned
                        </option>

                        {rooms
.filter(room => {
    if (!form.hostel_id) return true;

    return Number(room.hostel_id) === Number(form.hostel_id);
})
.map(room => {
                          const roomId = getRoomId(room);
                          const occupied =
                            getRoomOccupied(room);
                          const capacity =
                            getRoomCapacity(room);

                          const isCurrentRoom =
                            roomId === currentRoomId;

                          const isFull =
                            capacity > 0 &&
                            occupied >= capacity &&
                            !isCurrentRoom;

                          return (
                            <option
                              key={roomId}
                              value={roomId}
                              disabled={isFull}
                            >
                              {getRoomBlock(room)
                                ? `${getRoomBlock(room)} - `
                                : ''}
                              {getRoomNumber(room)} (
                              {occupied}/{capacity})
                              {isFull ? ' - Full' : ''}
                            </option>
                          );
                        })}
                      </select>

                      {isAllocating && (
                        <p className="mt-1 text-xs text-gray-400">
                          Updating room...
                        </p>
                      )}
                    </td>

                    <td>
                      <Badge color={getStatusColor(getStatus(student))}>
                        {getStatus(student)}
                      </Badge>
                    </td>

                    <td className="text-xs text-gray-500">
                      {student.phone || '—'}
                    </td>

                    <td className="whitespace-nowrap text-right">
                      <button
                        type="button"
                        className="mr-3 text-xs text-primary-600 hover:underline"
                        onClick={() => openEdit(student)}
                      >
                        Edit
                      </button>

                      {getStatus(student) === 'Active' && (
                        <button
                          type="button"
                          className="mr-3 text-xs text-amber-600 hover:underline"
                          onClick={() =>
                            handleCheckout(student)
                          }
                        >
                          Check-out
                        </button>
                      )}

                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => handleDelete(student)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-gray-400"
                  >
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Student' : 'Add Student'}
        wide
      >
        <form
          onSubmit={handleSave}
          className="space-y-4"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-400">
              {form.image ? (
                <img
                  src={form.image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                'Photo'
              )}
            </div>

            <div>
              <label className="label">
                Profile Photo
              </label>

              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  handleImage(event, 'image')
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Full Name</label>

              <input
                required
                name="name"
                className="input"
                value={form.name}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="label">Roll Number</label>

              <input
                name="roll_number"
                className="input"
                value={form.roll_number}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="label">Email</label>

              <input
                required
                name="email"
                type="email"
                disabled={Boolean(editing)}
                className="input"
                value={form.email}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="label">Phone</label>

              <input
                name="phone"
                className="input"
                value={form.phone}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="label">
                {editing ? 'New Password (optional)' : 'Password'}
              </label>

              <input
                required={!editing}
                type="password"
                name="password"
                autoComplete="new-password"
                className="input"
                placeholder={editing ? 'Leave blank to keep current' : ''}
                value={form.password}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="label">Course</label>

              <input
                name="course"
                className="input"
                value={form.course}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="label">Year</label>

              <input
                name="year"
                className="input"
                value={form.year}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="label">Gender</label>

              <select
                name="gender"
                className="input"
                value={form.gender}
                onChange={handleInputChange}
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="label">Date of Birth</label>

              <input
                name="dob"
                type="date"
                className="input"
                value={
                  form.dob
                    ? String(form.dob).slice(0, 10)
                    : ''
                }
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="label">Guardian Name</label>

              <input
                name="guardian_name"
                className="input"
                value={form.guardian_name}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="label">Guardian Phone</label>

              <input
                name="guardian_phone"
                className="input"
                value={form.guardian_phone}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label className="label">
                Emergency Contact
              </label>

              <input
                name="emergency_contact"
                className="input"
                value={form.emergency_contact}
                onChange={handleInputChange}
              />
            </div>

          <div>
  <label className="label">Hostel</label>

  <select
    name="hostel_id"
    className="input"
    value={form.hostel_id || ""}
    onChange={(e) =>
      setForm((prev) => ({
        ...prev,
        hostel_id: e.target.value,
        room_id: "",
      }))
    }
  >
    <option value="">Select Hostel</option>

    {hostels.map((hostel) => (
      <option key={hostel.id} value={hostel.id}>
        {hostel.name}
      </option>
    ))}
  </select>
</div>

<div>
  <label className="label">
    {editing ? "Room" : "Initial Room"}
  </label>

  <select
    name="room_id"
    className="input"
    value={form.room_id}
    onChange={handleInputChange}
  >
    <option value="">Unassigned</option>

    {rooms
      .filter(
        (room) =>
          !form.hostel_id ||
          Number(room.hostel_id) === Number(form.hostel_id)
      )
      .map((room) => {
        const roomId = getRoomId(room);
        const occupied = getRoomOccupied(room);
        const capacity = getRoomCapacity(room);

        const isFull =
          capacity > 0 &&
          occupied >= capacity &&
          roomId !== form.room_id;

        return (
          <option
            key={roomId}
            value={roomId}
            disabled={isFull}
          >
            {getRoomNumber(room)} ({occupied}/{capacity})
            {isFull ? " - Full" : ""}
          </option>
        );
      })}
  </select>
</div>
          </div>

          <div>
            <label className="label">Address</label>

            <textarea
              name="address"
              className="input"
              rows={2}
              value={form.address}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label className="label">ID Proof</label>

            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(event) =>
                handleImage(event, 'id_proof')
              }
            />
          </div>

          {err && (
            <p className="text-sm text-red-600">
              {err}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-outline"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
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

          {importErr && (
            <p className="text-sm text-red-600 animate-slide-down">{importErr}</p>
          )}

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
              {importing
                ? 'Importing...'
                : `Import ${importRows.length || ''} row${importRows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </Modal>
    </PortalLayout>
  );
}