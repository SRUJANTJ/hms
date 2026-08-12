import { useEffect, useState } from "react";
import PortalLayout from "@/components/PortalLayout";
import { ADMIN_LINKS } from "@/components/navLinks";
import { Modal, Badge, FullscreenLoader } from "@/components/ui";
import { useAuthGuard, apiFetch } from "@/lib/useAuthGuard";

export default function AdminRooms() {
  const { user, loading } = useAuthGuard(["admin"], "/admin/login");
  const [rooms, setRooms] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [tab, setTab] = useState("rooms");
  const [roomModal, setRoomModal] = useState(false);
  const [hostelModal, setHostelModal] = useState(false);
  const [wardens, setWardens] = useState([]);
  const [roomForm, setRoomForm] = useState({ hostel_id: "", block: "", floor: "", room_number: "", room_type: "Double", capacity: 2, monthly_rent: "" });
  const [hostelForm, setHostelForm] = useState({ name: "", address: "", capacity: "", warden_id: "" });
  const [err, setErr] = useState("");

  async function load() {
    const [r, h, meta] = await Promise.all([
      apiFetch("/api/admin/rooms"),
      apiFetch("/api/admin/hostels"),
      apiFetch("/api/admin/meta"),
    ]);
    setRooms(r);
    setHostels(h);
    setWardens(meta.wardens);
  }

  useEffect(() => {
    if (user) load().catch((e) => setErr(e.message));
  }, [user]);

  if (loading || !user) return <FullscreenLoader />;

  async function saveRoom(e) {
    e.preventDefault();
    setErr("");
    try {
      await apiFetch("/api/admin/rooms", { method: "POST", body: JSON.stringify(roomForm) });
      setRoomModal(false);
      setRoomForm({ hostel_id: "", block: "", floor: "", room_number: "", room_type: "Double", capacity: 2, monthly_rent: "" });
      await load();
    } catch (e2) { setErr(e2.message); }
  }

  async function saveHostel(e) {
    e.preventDefault();
    setErr("");
    try {
      await apiFetch("/api/admin/hostels", { method: "POST", body: JSON.stringify(hostelForm) });
      setHostelModal(false);
      setHostelForm({ name: "", address: "", capacity: "", warden_id: "" });
      await load();
    } catch (e2) { setErr(e2.message); }
  }

  async function deleteRoom(id) {
    if (!confirm("Delete this room?")) return;
    try {
      await apiFetch(`/api/admin/rooms/${id}`, { method: "DELETE" });
      await load();
    } catch (e2) { alert(e2.message); }
  }

  async function deleteHostel(id) {
    if (!confirm("Delete this hostel block?")) return;
    await apiFetch(`/api/admin/hostels/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <PortalLayout role="admin" user={user} links={ADMIN_LINKS} title="Rooms & Hostels">
      <div className="flex gap-2 mb-4">
        <button className={`btn ${tab === "rooms" ? "bg-primary-600 text-white" : "btn-outline"}`} onClick={() => setTab("rooms")}>Rooms</button>
        <button className={`btn ${tab === "hostels" ? "bg-primary-600 text-white" : "btn-outline"}`} onClick={() => setTab("hostels")}>Hostel Blocks</button>
        <div className="flex-1" />
        {tab === "rooms" ? (
          <button className="btn-primary" onClick={() => setRoomModal(true)}>+ Add Room</button>
        ) : (
          <button className="btn-primary" onClick={() => setHostelModal(true)}>+ Add Hostel</button>
        )}
      </div>

      {tab === "rooms" ? (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Room</th><th>Hostel</th><th>Type</th><th>Occupancy</th><th>Rent</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td>{r.block ? `${r.block} - ` : ""}{r.room_number}{r.floor ? ` (Floor ${r.floor})` : ""}</td>
                  <td>{r.hostel_name || "—"}</td>
                  <td>{r.room_type}</td>
                  <td>{r.occupied}/{r.capacity}</td>
                  <td>₹{Number(r.monthly_rent).toLocaleString()}</td>
                  <td><Badge color={r.status === "Available" ? "green" : r.status === "Full" ? "amber" : "red"}>{r.status}</Badge></td>
                  <td className="text-right"><button className="text-red-600 hover:underline text-xs" onClick={() => deleteRoom(r.id)}>Delete</button></td>
                </tr>
              ))}
              {rooms.length === 0 && <tr><td colSpan={7} className="text-center text-gray-400 py-8">No rooms yet.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Name</th><th>Address</th><th>Warden</th><th>Capacity</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {hostels.map((h) => (
                <tr key={h.id}>
                  <td>{h.name}</td><td>{h.address || "—"}</td><td>{h.warden_name || "Unassigned"}</td><td>{h.capacity}</td>
                  <td className="text-right"><button className="text-red-600 hover:underline text-xs" onClick={() => deleteHostel(h.id)}>Delete</button></td>
                </tr>
              ))}
              {hostels.length === 0 && <tr><td colSpan={5} className="text-center text-gray-400 py-8">No hostel blocks yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={roomModal} onClose={() => setRoomModal(false)} title="Add Room">
        <form onSubmit={saveRoom} className="space-y-3">
          <div>
            <label className="label">Hostel</label>
            <select className="input" value={roomForm.hostel_id} onChange={(e) => setRoomForm({ ...roomForm, hostel_id: e.target.value })}>
              <option value="">Select hostel</option>
              {hostels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Block</label><input className="input" value={roomForm.block} onChange={(e) => setRoomForm({ ...roomForm, block: e.target.value })} /></div>
            <div><label className="label">Floor</label><input className="input" value={roomForm.floor} onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })} /></div>
            <div><label className="label">Room Number</label><input required className="input" value={roomForm.room_number} onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })} /></div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={roomForm.room_type} onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })}>
                <option>Single</option><option>Double</option><option>Triple</option><option>Dormitory</option>
              </select>
            </div>
            <div><label className="label">Capacity</label><input required type="number" min={1} className="input" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} /></div>
            <div><label className="label">Monthly Rent (₹)</label><input type="number" min={0} className="input" value={roomForm.monthly_rent} onChange={(e) => setRoomForm({ ...roomForm, monthly_rent: e.target.value })} /></div>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-outline" onClick={() => setRoomModal(false)}>Cancel</button><button className="btn-primary">Save</button></div>
        </form>
      </Modal>

      <Modal open={hostelModal} onClose={() => setHostelModal(false)} title="Add Hostel Block">
        <form onSubmit={saveHostel} className="space-y-3">
          <div><label className="label">Name</label><input required className="input" value={hostelForm.name} onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })} /></div>
          <div><label className="label">Address</label><textarea className="input" value={hostelForm.address} onChange={(e) => setHostelForm({ ...hostelForm, address: e.target.value })} /></div>
          <div><label className="label">Capacity</label><input type="number" min={0} className="input" value={hostelForm.capacity} onChange={(e) => setHostelForm({ ...hostelForm, capacity: e.target.value })} /></div>
          <div>
            <label className="label">Assign Warden</label>
            <select className="input" value={hostelForm.warden_id} onChange={(e) => setHostelForm({ ...hostelForm, warden_id: e.target.value })}>
              <option value="">Unassigned</option>
              {wardens.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-outline" onClick={() => setHostelModal(false)}>Cancel</button><button className="btn-primary">Save</button></div>
        </form>
      </Modal>
    </PortalLayout>
  );
}
