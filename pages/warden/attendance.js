import { useEffect, useMemo, useState } from 'react';
import PortalLayout from '@/components/PortalLayout';
import { WARDEN_LINKS } from '@/components/navLinks';
import { FullscreenLoader } from '@/components/ui';
import { useAuthGuard, apiFetch } from '@/lib/useAuthGuard';

const today = () => new Date().toISOString().slice(0, 10);

const STATUSES = ['Present', 'Absent', 'Leave'];

export default function WardenAttendance() {
  const { user, loading } = useAuthGuard(
    ['warden'],
    '/warden/login'
  );

  const [date, setDate] = useState(today());
  const [list, setList] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [blockFilter, setBlockFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name_asc');

  const [saving, setSaving] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [err, setErr] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const getText = (value) => {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  };

  const getName = (student) => getText(student.name);

  const getRollNumber = (student) =>
    getText(student.roll_number || student.rollNumber);

  const getRoomNumber = (student) =>
    getText(student.room_number || student.roomNumber);

  const getBlock = (student) => getText(student.block);

  const getCourse = (student) => getText(student.course);

  const getPhone = (student) => getText(student.phone);

  const getStatus = (student) =>
    getText(student.status) || 'Present';

  /*
    Every row gets a guaranteed unique internal key.

    The API ID is used when available. If it is missing, a
    fallback key is created so one row cannot update another row.
  */
  const getStudentKey = (student, index = 0) => {
    return String(
      student._attendanceKey ||
        student.student_id ||
        student.id ||
        student._id ||
        student.roll_number ||
        student.rollNumber ||
        `attendance-row-${index}`
    );
  };

  const loadAttendance = async () => {
    setLoadingRecords(true);
    setErr('');
    setSuccessMessage('');

    try {
      const data = await apiFetch(
        `/api/admin/attendance?date=${encodeURIComponent(date)}`
      );

      const records = Array.isArray(data) ? data : [];

      const normalizedRecords = records.map((record, index) => ({
        ...record,
        _attendanceKey: getStudentKey(record, index),
        status: record.status || 'Present',
      }));

      setList(normalizedRecords);

      // Clear old selections when date/data changes
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error loading attendance:', error);
      setErr(error.message || 'Failed to load attendance');
      setList([]);
      setSelectedIds(new Set());
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadAttendance();
    }
  }, [user, date]);

  const courses = useMemo(() => {
    return [
      ...new Set(
        list
          .map((student) => getCourse(student))
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [list]);

  const blocks = useMemo(() => {
    return [
      ...new Set(
        list
          .map((student) => getBlock(student))
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [list]);

  const filteredList = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = list.filter((student) => {
      const name = getName(student).toLowerCase();
      const roll = getRollNumber(student).toLowerCase();
      const room = getRoomNumber(student).toLowerCase();
      const block = getBlock(student).toLowerCase();
      const course = getCourse(student).toLowerCase();
      const phone = getPhone(student).toLowerCase();

      const matchesSearch =
        !query ||
        name.includes(query) ||
        roll.includes(query) ||
        room.includes(query) ||
        block.includes(query) ||
        course.includes(query) ||
        phone.includes(query);

      const matchesStatus =
        statusFilter === 'all' ||
        getStatus(student) === statusFilter;

      const matchesCourse =
        courseFilter === 'all' ||
        getCourse(student) === courseFilter;

      const matchesBlock =
        blockFilter === 'all' ||
        getBlock(student) === blockFilter;

      const hasRoom = Boolean(getRoomNumber(student));

      const matchesRoom =
        roomFilter === 'all' ||
        (roomFilter === 'assigned' && hasRoom) ||
        (roomFilter === 'unassigned' && !hasRoom);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCourse &&
        matchesBlock &&
        matchesRoom
      );
    });

    return [...filtered].sort((first, second) => {
      switch (sortBy) {
        case 'name_desc':
          return getName(second).localeCompare(getName(first));

        case 'roll_asc':
          return getRollNumber(first).localeCompare(
            getRollNumber(second),
            undefined,
            { numeric: true }
          );

        case 'roll_desc':
          return getRollNumber(second).localeCompare(
            getRollNumber(first),
            undefined,
            { numeric: true }
          );

        case 'room_asc':
          return getRoomNumber(first).localeCompare(
            getRoomNumber(second),
            undefined,
            { numeric: true }
          );

        case 'room_desc':
          return getRoomNumber(second).localeCompare(
            getRoomNumber(first),
            undefined,
            { numeric: true }
          );

        case 'status':
          return getStatus(first).localeCompare(
            getStatus(second)
          );

        case 'name_asc':
        default:
          return getName(first).localeCompare(getName(second));
      }
    });
  }, [
    list,
    search,
    statusFilter,
    courseFilter,
    blockFilter,
    roomFilter,
    sortBy,
  ]);

  /*
    Update exactly one row by its unique internal key.
  */
  const setStudentStatus = (studentKey, status) => {
    setList((currentList) =>
      currentList.map((student) =>
        student._attendanceKey === studentKey
          ? {
              ...student,
              status,
            }
          : student
      )
    );
  };

  /*
    Select or unselect one checkbox.
  */
  const toggleStudent = (studentKey) => {
    setSelectedIds((currentSelected) => {
      const nextSelected = new Set(currentSelected);

      if (nextSelected.has(studentKey)) {
        nextSelected.delete(studentKey);
      } else {
        nextSelected.add(studentKey);
      }

      return nextSelected;
    });
  };

  const visibleKeys = filteredList.map(
    (student) => student._attendanceKey
  );

  const allVisibleSelected =
    visibleKeys.length > 0 &&
    visibleKeys.every((key) => selectedIds.has(key));

  const someVisibleSelected =
    visibleKeys.some((key) => selectedIds.has(key));

  /*
    Select all currently visible/filtered rows.
    This does not select hidden rows.
  */
  const toggleSelectAllVisible = () => {
    setSelectedIds((currentSelected) => {
      const nextSelected = new Set(currentSelected);

      if (allVisibleSelected) {
        visibleKeys.forEach((key) => nextSelected.delete(key));
      } else {
        visibleKeys.forEach((key) => nextSelected.add(key));
      }

      return nextSelected;
    });
  };

  /*
    Mark only checked students.
  */
  const markSelectedStudents = (status) => {
    if (selectedIds.size === 0) {
      setErr('Select at least one student first.');
      return;
    }

    setErr('');

    setList((currentList) =>
      currentList.map((student) =>
        selectedIds.has(student._attendanceKey)
          ? {
              ...student,
              status,
            }
          : student
      )
    );
  };

  const saveAll = async () => {
    setSaving(true);
    setErr('');
    setSuccessMessage('');

    try {
      await apiFetch('/api/admin/attendance', {
        method: 'POST',
        body: JSON.stringify({
          date,
          records: list.map((student) => ({
            student_id:
              student.student_id ||
              student.id ||
              student._id,

            status: student.status || 'Present',
          })),
        }),
      });

      setSuccessMessage(
        `Attendance saved successfully for ${date}.`
      );

      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error saving attendance:', error);
      setErr(error.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCourseFilter('all');
    setBlockFilter('all');
    setRoomFilter('all');
    setSortBy('name_asc');
  };

  const presentCount = list.filter(
    (student) => getStatus(student) === 'Present'
  ).length;

  const absentCount = list.filter(
    (student) => getStatus(student) === 'Absent'
  ).length;

  const leaveCount = list.filter(
    (student) => getStatus(student) === 'Leave'
  ).length;

  if (loading || !user) {
    return <FullscreenLoader />;
  }

  return (
    <PortalLayout
      role="warden"
      user={user}
      links={WARDEN_LINKS}
      title="Attendance"
    >
      <div className="space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              Student Attendance
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Select students using checkboxes before applying bulk attendance.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAttendance}
            disabled={loadingRecords}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingRecords ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <label
                htmlFor="attendance-date"
                className="mb-1 block text-xs font-medium text-gray-500"
              >
                Attendance date
              </label>

              <input
                id="attendance-date"
                type="date"
                className="input max-w-[180px]"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>

            <button
              type="button"
              onClick={saveAll}
              disabled={saving || loadingRecords}
              className="btn bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>

            {err && (
              <p className="text-sm text-red-600">
                {err}
              </p>
            )}

            {successMessage && (
              <p className="text-sm text-emerald-600">
                {successMessage}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">Total</p>
            <p className="mt-1 text-2xl font-bold text-gray-800">
              {list.length}
            </p>
          </div>

          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-xs text-emerald-700">Present</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">
              {presentCount}
            </p>
          </div>

          <div className="rounded-xl bg-red-50 p-4">
            <p className="text-xs text-red-700">Absent</p>
            <p className="mt-1 text-2xl font-bold text-red-700">
              {absentCount}
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 p-4">
            <p className="text-xs text-amber-700">Leave</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">
              {leaveCount}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              type="search"
              className="input"
              placeholder="Search name, roll no, room..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              className="input"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="all">All statuses</option>

              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              className="input"
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

            <select
              className="input"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="name_asc">Name: A–Z</option>
              <option value="name_desc">Name: Z–A</option>
              <option value="roll_asc">Roll: Low–High</option>
              <option value="roll_desc">Roll: High–Low</option>
              <option value="room_asc">Room: Low–High</option>
              <option value="room_desc">Room: High–Low</option>
              <option value="status">Status</option>
            </select>

            <select
              className="input"
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

            <select
              className="input"
              value={roomFilter}
              onChange={(event) =>
                setRoomFilter(event.target.value)
              }
            >
              <option value="all">All students</option>
              <option value="assigned">Assigned room</option>
              <option value="unassigned">
                Unassigned room
              </option>
            </select>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <p className="text-sm text-gray-500">
            Selected:{' '}
            <span className="font-semibold text-gray-800">
              {selectedIds.size}
            </span>{' '}
            / {filteredList.length}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => markSelectedStudents('Present')}
              disabled={selectedIds.size === 0}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark selected Present
            </button>

            <button
              type="button"
              onClick={() => markSelectedStudents('Absent')}
              disabled={selectedIds.size === 0}
              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark selected Absent
            </button>

            <button
              type="button"
              onClick={() => markSelectedStudents('Leave')}
              disabled={selectedIds.size === 0}
              className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark selected Leave
            </button>
          </div>
        </div>

        <div className="table-wrap overflow-x-auto">
          <table className="data min-w-[950px]">
            <thead>
              <tr>
                <th className="w-12">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(element) => {
                      if (element) {
                        element.indeterminate =
                          !allVisibleSelected &&
                          someVisibleSelected;
                      }
                    }}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all visible students"
                  />
                </th>

                <th>Student</th>
                <th>Roll No</th>
                <th>Room</th>
                <th>Course</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredList.map((student) => {
                const studentKey = student._attendanceKey;
                const currentStatus = getStatus(student);
                const roomNumber = getRoomNumber(student);
                const block = getBlock(student);

                return (
                  <tr key={studentKey}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(studentKey)}
                        onChange={() =>
                          toggleStudent(studentKey)
                        }
                        aria-label={`Select ${getName(student)}`}
                      />
                    </td>

                    <td>
                      <div className="font-medium text-gray-800">
                        {getName(student) || 'Unnamed student'}
                      </div>

                      {getPhone(student) && (
                        <div className="text-xs text-gray-400">
                          {getPhone(student)}
                        </div>
                      )}
                    </td>

                    <td>{getRollNumber(student) || '—'}</td>

                    <td>
                      {roomNumber
                        ? `${block ? `${block} - ` : ''}${roomNumber}`
                        : 'Unassigned'}
                    </td>

                    <td>{getCourse(student) || '—'}</td>

                    <td>
                      <div className="flex flex-wrap gap-2">
                        {STATUSES.map((status) => {
                          const active =
                            currentStatus === status;

                          const activeClass =
                            status === 'Present'
                              ? 'bg-emerald-600 text-white'
                              : status === 'Absent'
                                ? 'bg-red-600 text-white'
                                : 'bg-amber-500 text-white';

                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={() =>
                                setStudentStatus(
                                  studentKey,
                                  status
                                )
                              }
                              className={`rounded-lg px-3 py-1 text-xs font-medium ${
                                active
                                  ? activeClass
                                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {status}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredList.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
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
    </PortalLayout>
  );
}