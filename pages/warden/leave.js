import { useEffect, useMemo, useState } from 'react';
import PortalLayout from '@/components/PortalLayout';
import { WARDEN_LINKS } from '@/components/navLinks';
import { Badge, FullscreenLoader } from '@/components/ui';
import { useAuthGuard, apiFetch } from '@/lib/useAuthGuard';

const LEAVE_STATUSES = [
  'Pending',
  'Approved',
  'Rejected',
];

export default function WardenLeave() {
  const { user, loading } = useAuthGuard(
    ['warden'],
    '/warden/login'
  );

  const [leaves, setLeaves] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [blockFilter, setBlockFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');
  const [sortBy, setSortBy] = useState('latest');

  const [err, setErr] = useState('');
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);

  const getText = (value) => {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  };

  const getDateOnly = (value) => {
    if (!value) return '';

    return String(value).slice(0, 10);
  };

  const getStudentName = (leave) => {
    return getText(
      leave.student_name ||
        leave.studentName ||
        leave.name
    );
  };

  const getRollNumber = (leave) => {
    return getText(
      leave.roll_number ||
        leave.rollNumber
    );
  };

  const getCourse = (leave) => {
    return getText(leave.course);
  };

  const getBlock = (leave) => {
    return getText(leave.block);
  };

  const getRoomNumber = (leave) => {
    return getText(
      leave.room_number ||
        leave.roomNumber
    );
  };

  const getStatus = (leave) => {
    return getText(leave.status) || 'Pending';
  };

  const getLeaveId = (leave) => {
    return leave.id || leave._id;
  };

  const getCreatedDate = (leave) => {
    const value =
      leave.created_at ||
      leave.createdAt ||
      leave.applied_at ||
      leave.appliedAt ||
      leave.updated_at ||
      leave.updatedAt;

    if (!value) return 0;

    const timestamp = new Date(value).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  const load = async () => {
    setLoadingLeaves(true);
    setErr('');

    try {
      const data = await apiFetch('/api/admin/leave');

      setLeaves(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading leave requests:', error);
      setErr(
        error.message || 'Failed to load leave requests'
      );
      setLeaves([]);
    } finally {
      setLoadingLeaves(false);
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
        leaves
          .map((leave) => getCourse(leave))
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [leaves]);

  const blocks = useMemo(() => {
    return [
      ...new Set(
        leaves
          .map((leave) => getBlock(leave))
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [leaves]);

  const filteredLeaves = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = leaves.filter((leave) => {
      const studentName =
        getStudentName(leave).toLowerCase();

      const rollNumber =
        getRollNumber(leave).toLowerCase();

      const reason =
        getText(leave.reason).toLowerCase();

      const course =
        getCourse(leave).toLowerCase();

      const block =
        getBlock(leave).toLowerCase();

      const room =
        getRoomNumber(leave).toLowerCase();

      const status = getStatus(leave);

      const leaveFrom = getDateOnly(leave.from_date);
      const leaveTo = getDateOnly(leave.to_date);

      const matchesSearch =
        !query ||
        studentName.includes(query) ||
        rollNumber.includes(query) ||
        reason.includes(query) ||
        course.includes(query) ||
        block.includes(query) ||
        room.includes(query);

      const matchesStatus =
        statusFilter === 'all' ||
        status === statusFilter;

      const matchesCourse =
        courseFilter === 'all' ||
        getCourse(leave) === courseFilter;

      const matchesBlock =
        blockFilter === 'all' ||
        getBlock(leave) === blockFilter;

      const hasRoom = Boolean(getRoomNumber(leave));

      const matchesRoom =
        roomFilter === 'all' ||
        (roomFilter === 'assigned' && hasRoom) ||
        (roomFilter === 'unassigned' && !hasRoom);

      /*
        A leave overlaps the selected date range when:

        leave.to_date >= selected.from_date
        AND
        leave.from_date <= selected.to_date
      */
      const matchesFromDate =
        !fromDateFilter ||
        leaveTo >= fromDateFilter;

      const matchesToDate =
        !toDateFilter ||
        leaveFrom <= toDateFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCourse &&
        matchesBlock &&
        matchesRoom &&
        matchesFromDate &&
        matchesToDate
      );
    });

    return [...result].sort((first, second) => {
      switch (sortBy) {
        case 'oldest':
          return (
            getCreatedDate(first) -
            getCreatedDate(second)
          );

        case 'name_asc':
          return getStudentName(first).localeCompare(
            getStudentName(second)
          );

        case 'name_desc':
          return getStudentName(second).localeCompare(
            getStudentName(first)
          );

        case 'from_asc':
          return getDateOnly(first.from_date).localeCompare(
            getDateOnly(second.from_date)
          );

        case 'from_desc':
          return getDateOnly(second.from_date).localeCompare(
            getDateOnly(first.from_date)
          );

        case 'status':
          return getStatus(first).localeCompare(
            getStatus(second)
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
    leaves,
    search,
    statusFilter,
    courseFilter,
    blockFilter,
    roomFilter,
    fromDateFilter,
    toDateFilter,
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
    setBlockFilter('all');
    setRoomFilter('all');
    setFromDateFilter('');
    setToDateFilter('');
    setSortBy('latest');
  };

  const review = async (leave, status) => {
    const leaveId = getLeaveId(leave);

    if (!leaveId) {
      setErr('This leave request does not have a valid ID.');
      return;
    }

    setReviewingId(leaveId);
    setErr('');

    try {
      await apiFetch(`/api/admin/leave/${leaveId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
        }),
      });

      /*
        Update only the selected leave request locally.
        This avoids changing other students' requests.
      */
      setLeaves((currentLeaves) =>
        currentLeaves.map((item) =>
          String(getLeaveId(item)) === String(leaveId)
            ? {
                ...item,
                status,
              }
            : item
        )
      );
    } catch (error) {
      console.error('Error reviewing leave request:', error);
      setErr(
        error.message || 'Failed to update leave request'
      );
    } finally {
      setReviewingId(null);
    }
  };

  const getBadgeColor = (status) => {
    if (status === 'Approved') return 'green';
    if (status === 'Rejected') return 'red';

    return 'amber';
  };

  if (loading || !user) {
    return <FullscreenLoader />;
  }

  return (
    <PortalLayout
      role="warden"
      user={user}
      links={WARDEN_LINKS}
      title="Leave Requests"
    >
      <div className="space-y-5">
        {/* Heading */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              Leave Requests
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Review and manage student leave applications.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loadingLeaves}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing || loadingLeaves
              ? 'Refreshing...'
              : 'Refresh'}
          </button>
        </div>

        {err && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {err}
          </div>
        )}

        {/* Filters */}
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="leave-search"
                className="mb-1 block text-xs font-medium text-gray-500"
              >
                Search
              </label>

              <input
                id="leave-search"
                type="search"
                className="input w-full"
                placeholder="Student, roll no, reason..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <div>
              <label
                htmlFor="leave-status"
                className="mb-1 block text-xs font-medium text-gray-500"
              >
                Status
              </label>

              <select
                id="leave-status"
                className="input w-full"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="all">All statuses</option>

                {LEAVE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="leave-course"
                className="mb-1 block text-xs font-medium text-gray-500"
              >
                Course
              </label>

              <select
                id="leave-course"
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
              <label
                htmlFor="leave-sort"
                className="mb-1 block text-xs font-medium text-gray-500"
              >
                Sort by
              </label>

              <select
                id="leave-sort"
                className="input w-full"
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value)
                }
              >
                <option value="latest">
                  Latest requests
                </option>
                <option value="oldest">
                  Oldest requests
                </option>
                <option value="name_asc">
                  Student: A–Z
                </option>
                <option value="name_desc">
                  Student: Z–A
                </option>
                <option value="from_asc">
                  Leave start: Earliest
                </option>
                <option value="from_desc">
                  Leave start: Latest
                </option>
                <option value="status">
                  Status
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="leave-from-date"
                className="mb-1 block text-xs font-medium text-gray-500"
              >
                Leave overlaps from
              </label>

              <input
                id="leave-from-date"
                type="date"
                className="input w-full"
                value={fromDateFilter}
                onChange={(event) =>
                  setFromDateFilter(event.target.value)
                }
              />
            </div>

            <div>
              <label
                htmlFor="leave-to-date"
                className="mb-1 block text-xs font-medium text-gray-500"
              >
                Leave overlaps until
              </label>

              <input
                id="leave-to-date"
                type="date"
                className="input w-full"
                value={toDateFilter}
                onChange={(event) =>
                  setToDateFilter(event.target.value)
                }
              />
            </div>

            <div>
              <label
                htmlFor="leave-block"
                className="mb-1 block text-xs font-medium text-gray-500"
              >
                Block
              </label>

              <select
                id="leave-block"
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
              <label
                htmlFor="leave-room"
                className="mb-1 block text-xs font-medium text-gray-500"
              >
                Room assignment
              </label>

              <select
                id="leave-room"
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
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
              >
                Clear filters
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing{' '}
            <span className="font-semibold text-gray-800">
              {filteredLeaves.length}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-gray-800">
              {leaves.length}
            </span>{' '}
            leave requests
          </p>
        </div>

        {/* Table */}
        <div className="table-wrap overflow-x-auto">
          <table className="data min-w-[950px]">
            <thead>
              <tr>
                <th>Student</th>
                <th>Room</th>
                <th>From</th>
                <th>To</th>
                <th>Reason</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredLeaves.map((leave, index) => {
                const leaveId = getLeaveId(leave);
                const status = getStatus(leave);
                const room = getRoomNumber(leave);
                const block = getBlock(leave);

                return (
                  <tr key={leaveId || `leave-${index}`}>
                    <td>
                      <div className="font-medium text-gray-800">
                        {getStudentName(leave) ||
                          'Unknown student'}
                      </div>

                      <div className="text-xs text-gray-400">
                        Roll:{' '}
                        {getRollNumber(leave) || '—'}
                      </div>

                      {getCourse(leave) && (
                        <div className="text-xs text-gray-400">
                          {getCourse(leave)}
                        </div>
                      )}
                    </td>

                    <td>
                      {room ? (
                        `${block ? `${block} - ` : ''}${room}`
                      ) : (
                        <span className="text-gray-400">
                          Unassigned
                        </span>
                      )}
                    </td>

                    <td>
                      {getDateOnly(leave.from_date) || '—'}
                    </td>

                    <td>
                      {getDateOnly(leave.to_date) || '—'}
                    </td>

                    <td className="max-w-xs">
                      <span
                        className="block truncate"
                        title={leave.reason || ''}
                      >
                        {leave.reason || '—'}
                      </span>
                    </td>

                    <td>
                      <Badge color={getBadgeColor(status)}>
                        {status}
                      </Badge>
                    </td>

                    <td className="whitespace-nowrap text-right">
                      {status === 'Pending' ? (
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            disabled={reviewingId === leaveId}
                            onClick={() =>
                              review(leave, 'Approved')
                            }
                            className="text-xs text-emerald-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {reviewingId === leaveId
                              ? 'Updating...'
                              : 'Approve'}
                          </button>

                          <button
                            type="button"
                            disabled={reviewingId === leaveId}
                            onClick={() =>
                              review(leave, 'Rejected')
                            }
                            className="text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">
                          Reviewed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredLeaves.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-gray-400"
                  >
                    No leave requests found.
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