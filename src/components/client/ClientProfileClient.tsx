"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Mail, Phone, Target, Dumbbell, HeartPulse, KeyRound, Ruler, Weight, Scale } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import TagEditor from "@/components/ui/TagEditor";
import { supabase } from "@/lib/supabase";
import { ClientProfileView, updateMyProfileAction } from "@/lib/actions/client-profile.actions";
import { isFailure } from "@/lib/actions/action-result";

export default function ClientProfileClient({ profile }: { profile: ClientProfileView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [goals, setGoals] = useState(profile.goals);
  const [equipment, setEquipment] = useState(profile.equipment);
  const [medicalNotes, setMedicalNotes] = useState(profile.medicalNotes ?? "");

  const [pwOpen, setPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  function openPasswordModal() {
    setNewPassword("");
    setConfirmPassword("");
    setPwError("");
    setPwSuccess(false);
    setPwOpen(true);
  }

  async function changePassword() {
    if (newPassword.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords don't match.");
      return;
    }
    setPwBusy(true);
    setPwError("");
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setPwBusy(false);
    if (updateError) {
      setPwError(updateError.message);
      return;
    }
    setPwSuccess(true);
  }

  function openEdit() {
    setName(profile.name);
    setPhone(profile.phone ?? "");
    setGoals(profile.goals);
    setEquipment(profile.equipment);
    setMedicalNotes(profile.medicalNotes ?? "");
    setError("");
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    setError("");
    const result = await updateMyProfileAction({ fullName: name, phone, goals, equipment, medicalNotes });
    setBusy(false);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-2xl">
            <Image src={profile.photo} alt={profile.name} fill className="object-cover" />
          </div>
          <div>
            <p className="text-display text-xl font-bold italic">{profile.name || "Add your name"}</p>
            {profile.packageName && <p className="text-sm text-white/45">{profile.packageName}</p>}
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={openEdit}>
            Edit
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-white/[0.06] pt-6 sm:grid-cols-2">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-white/40" />
            {profile.email}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-white/40" />
            {profile.phone || "Not set"}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-6">
          <div className="flex items-center gap-2 text-sm">
            <Ruler className="h-4 w-4 text-white/40" />
            {profile.heightCm ? `${profile.heightCm} cm` : "Height —"}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Weight className="h-4 w-4 text-white/40" />
            {profile.weightKg ? `${profile.weightKg} kg` : "Weight —"}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Scale className="h-4 w-4 text-white/40" />
            {profile.bmi ? `BMI ${profile.bmi}` : "BMI —"}
          </div>
        </div>

        <div className="mt-6 border-t border-white/[0.06] pt-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/40">
            <Target className="h-3.5 w-3.5" /> Goals
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.goals.length === 0 && <span className="text-sm text-white/40">No goals set yet.</span>}
            {profile.goals.map((g) => (
              <span key={g} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                {g}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-white/[0.06] pt-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/40">
            <Dumbbell className="h-3.5 w-3.5" /> Equipment
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.equipment.length === 0 && <span className="text-sm text-white/40">No equipment listed.</span>}
            {profile.equipment.map((g) => (
              <span key={g} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                {g}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-white/[0.06] pt-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/40">
            <HeartPulse className="h-3.5 w-3.5" /> Medical Notes
          </p>
          <p className="text-sm text-white/60">{profile.medicalNotes || "None on file."}</p>
        </div>

        <div className="mt-6 border-t border-white/[0.06] pt-6">
          <Button variant="outline" size="sm" onClick={openPasswordModal}>
            <KeyRound className="h-3.5 w-3.5" /> Change Password
          </Button>
        </div>
      </Card>

      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Change Password">
        {!pwSuccess ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="glass-faint w-full rounded-xl p-2.5 text-sm text-white outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="glass-faint w-full rounded-xl p-2.5 text-sm text-white outline-none focus:border-white/20"
              />
            </div>
            {pwError && <p className="text-xs text-red-400">{pwError}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setPwOpen(false)}>
                Cancel
              </Button>
              <Button loading={pwBusy} onClick={changePassword}>
                Update Password
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-display text-lg font-bold italic">Password updated</p>
            <p className="mt-1 text-sm text-white/50">Use your new password next time you sign in.</p>
            <Button className="mt-4" variant="outline" onClick={() => setPwOpen(false)}>
              Close
            </Button>
          </div>
        )}
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit Profile">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="glass-faint w-full rounded-xl p-2.5 text-sm text-white outline-none focus:border-white/20" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="glass-faint w-full rounded-xl p-2.5 text-sm text-white outline-none focus:border-white/20" />
          </div>
          <TagEditor label="Goals" values={goals} onChange={setGoals} />
          <TagEditor label="Equipment" values={equipment} onChange={setEquipment} />
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Medical Notes</label>
            <textarea
              value={medicalNotes}
              onChange={(e) => setMedicalNotes(e.target.value)}
              rows={3}
              className="glass-faint w-full rounded-xl p-2.5 text-sm text-white outline-none focus:border-white/20"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={save}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
