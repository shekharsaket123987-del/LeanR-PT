import { Coach, Client, Session, PackageTier, Testimonial, NotificationItem, CoachChangeRequest } from "./types";

export const coaches: Coach[] = [
  {
    id: "c1",
    name: "Arjun Mehta",
    photo: "https://i.pravatar.cc/300?img=12",
    specialization: "Strength & Conditioning",
    secondarySpecializations: ["Fat Loss", "Powerlifting"],
    yearsExperience: 8,
    rating: 4.9,
    reviewCount: 214,
    bio: "Arjun specializes in building raw strength and sustainable fat loss through progressive overload and smart programming. Former state-level powerlifter, now helping everyday people move better and lift heavier.",
    certifications: ["ACE-CPT", "Precision Nutrition L1", "FMS Level 2"],
    languages: ["English", "Hindi"],
    activeClients: 18,
    utilization: 86,
    status: "active",
  },
  {
    id: "c2",
    name: "Priya Nair",
    photo: "https://i.pravatar.cc/300?img=47",
    specialization: "Weight Loss & HIIT",
    secondarySpecializations: ["Metabolic Conditioning", "Nutrition Coaching"],
    yearsExperience: 6,
    rating: 4.8,
    reviewCount: 176,
    bio: "Priya builds high-energy, sustainable weight-loss programs that fit into real, busy lives. Her clients love her no-nonsense coaching style paired with genuine encouragement.",
    certifications: ["NASM-CPT", "Precision Nutrition L2"],
    languages: ["English", "Hindi", "Malayalam"],
    activeClients: 22,
    utilization: 91,
    status: "active",
  },
  {
    id: "c3",
    name: "Rohan Kapoor",
    photo: "https://i.pravatar.cc/300?img=33",
    specialization: "Mobility & Rehab",
    secondarySpecializations: ["Injury Recovery", "Corrective Exercise"],
    yearsExperience: 10,
    rating: 5.0,
    reviewCount: 289,
    bio: "A physiotherapist-turned-coach, Rohan works with clients recovering from injury or dealing with chronic pain — rebuilding strength the right way, without shortcuts.",
    certifications: ["DPT", "FMS Level 2", "NASM-CES"],
    languages: ["English", "Hindi", "Punjabi"],
    activeClients: 14,
    utilization: 72,
    status: "active",
  },
  {
    id: "c4",
    name: "Simran Kaur",
    photo: "https://i.pravatar.cc/300?img=45",
    specialization: "Yoga & Functional Fitness",
    secondarySpecializations: ["Flexibility", "Stress Management"],
    yearsExperience: 7,
    rating: 4.9,
    reviewCount: 198,
    bio: "Simran blends functional strength training with yoga-based mobility work, helping clients build a body that feels as good as it looks.",
    certifications: ["RYT-500", "ACE-CPT"],
    languages: ["English", "Hindi", "Punjabi"],
    activeClients: 16,
    utilization: 80,
    status: "active",
  },
  {
    id: "c5",
    name: "Vikram Singh",
    photo: "https://i.pravatar.cc/300?img=14",
    specialization: "Bodybuilding & Hypertrophy",
    secondarySpecializations: ["Muscle Gain", "Contest Prep"],
    yearsExperience: 12,
    rating: 4.8,
    reviewCount: 341,
    bio: "Vikram has coached over 40 clients through physique transformations, competition prep, and long-term hypertrophy programs.",
    certifications: ["ISSA-CPT", "Precision Nutrition L1"],
    languages: ["English", "Hindi"],
    activeClients: 20,
    utilization: 88,
    status: "active",
  },
  {
    id: "c6",
    name: "Ananya Desai",
    photo: "https://i.pravatar.cc/300?img=48",
    specialization: "Postnatal & Women's Fitness",
    secondarySpecializations: ["Core Recovery", "Prenatal Fitness"],
    yearsExperience: 5,
    rating: 4.9,
    reviewCount: 132,
    bio: "Ananya helps new and expecting mothers rebuild strength safely, with programs designed around real recovery timelines, not generic templates.",
    certifications: ["Pre/Postnatal Cert (ACE)", "NASM-CPT"],
    languages: ["English", "Hindi", "Gujarati"],
    activeClients: 12,
    utilization: 65,
    status: "active",
  },
  {
    id: "c7",
    name: "Karan Malhotra",
    photo: "https://i.pravatar.cc/300?img=51",
    specialization: "Athletic Performance",
    secondarySpecializations: ["Speed & Agility", "Sports Conditioning"],
    yearsExperience: 9,
    rating: 4.7,
    reviewCount: 165,
    bio: "Karan trains athletes and weekend warriors alike, focused on explosive power, agility, and injury-resistant movement patterns.",
    certifications: ["CSCS", "USAW L1"],
    languages: ["English", "Hindi"],
    activeClients: 15,
    utilization: 78,
    status: "on-leave",
  },
  {
    id: "c8",
    name: "Meera Iyer",
    photo: "https://i.pravatar.cc/300?img=44",
    specialization: "General Fitness & Habit Coaching",
    secondarySpecializations: ["Beginner Programs", "Accountability Coaching"],
    yearsExperience: 4,
    rating: 4.9,
    reviewCount: 97,
    bio: "Meera specializes in working with total beginners — building confidence, consistency, and technique from session one.",
    certifications: ["ACE-CPT"],
    languages: ["English", "Hindi", "Tamil"],
    activeClients: 10,
    utilization: 58,
    status: "active",
  },
];

export const clients: Client[] = [
  { id: "u1", name: "Saket Shekhar", photo: "https://i.pravatar.cc/300?img=68", email: "shekharsaket123987@gmail.com", phone: "+91 98765 43210", coachId: "c1", packageName: "LeanR Advance", sessionsTotal: 24, sessionsUsed: 9, sessionsRemaining: 15, status: "active", joinedDate: "2026-03-14", streak: 6, goals: ["Fat loss", "Build strength"], medicalNotes: "Mild lower back stiffness — avoid heavy spinal loading without warmup.", equipment: ["Dumbbells", "Resistance bands", "Pull-up bar"] },
  { id: "u2", name: "Ishita Rao", photo: "https://i.pravatar.cc/300?img=32", email: "ishita.rao@example.com", phone: "+91 98450 11223", coachId: "c2", packageName: "PT Add-on 24", sessionsTotal: 24, sessionsUsed: 21, sessionsRemaining: 3, status: "active", joinedDate: "2025-11-02", streak: 14, goals: ["Weight loss", "Toning"], medicalNotes: "None reported.", equipment: ["Full home gym"] },
  { id: "u3", name: "Aditya Verma", photo: "https://i.pravatar.cc/300?img=15", email: "aditya.verma@example.com", phone: "+91 99001 22334", coachId: "c1", packageName: "LeanR Advance", sessionsTotal: 48, sessionsUsed: 12, sessionsRemaining: 36, status: "active", joinedDate: "2026-01-20", streak: 3, goals: ["Muscle gain"], medicalNotes: "Right shoulder impingement — modify overhead press.", equipment: ["Barbell", "Rack", "Dumbbells"] },
  { id: "u4", name: "Neha Gupta", photo: "https://i.pravatar.cc/300?img=29", email: "neha.gupta@example.com", phone: "+91 97123 45678", coachId: "c3", packageName: "PT Add-on 12", sessionsTotal: 12, sessionsUsed: 4, sessionsRemaining: 8, status: "active", joinedDate: "2026-05-01", streak: 2, goals: ["Injury recovery", "Mobility"], medicalNotes: "Post ACL surgery (8 months out), cleared for light loading.", equipment: ["Resistance bands", "Yoga mat"] },
  { id: "u5", name: "Kabir Anand", photo: "https://i.pravatar.cc/300?img=11", email: "kabir.anand@example.com", phone: "+91 98111 22221", coachId: "c5", packageName: "LeanR Advance", sessionsTotal: 24, sessionsUsed: 24, sessionsRemaining: 0, status: "inactive", joinedDate: "2025-08-10", streak: 0, goals: ["Bodybuilding"], medicalNotes: "None reported.", equipment: ["Full gym access"] },
  { id: "u6", name: "Tanya Chopra", photo: "https://i.pravatar.cc/300?img=41", email: "tanya.chopra@example.com", phone: "+91 96654 32109", coachId: "c4", packageName: "PT Add-on 24", sessionsTotal: 24, sessionsUsed: 8, sessionsRemaining: 16, status: "active", joinedDate: "2026-04-18", streak: 5, goals: ["Flexibility", "Stress relief"], medicalNotes: "None reported.", equipment: ["Yoga mat", "Blocks"] },
  { id: "u7", name: "Rahul Bansal", photo: "https://i.pravatar.cc/300?img=53", email: "rahul.bansal@example.com", phone: "+91 90000 11122", coachId: "c1", packageName: "LeanR Advance", sessionsTotal: 48, sessionsUsed: 3, sessionsRemaining: 45, status: "active", joinedDate: "2026-07-10", streak: 1, goals: ["General fitness"], medicalNotes: "None reported.", equipment: ["Dumbbells"] },
  { id: "u8", name: "Divya Krishnan", photo: "https://i.pravatar.cc/300?img=36", email: "divya.k@example.com", phone: "+91 93456 78901", coachId: "c6", packageName: "PT Add-on 12", sessionsTotal: 12, sessionsUsed: 6, sessionsRemaining: 6, status: "paused", joinedDate: "2026-02-08", streak: 0, goals: ["Postnatal recovery"], medicalNotes: "6 weeks postpartum — core-safe programming only.", equipment: ["Yoga mat", "Light dumbbells"] },
  { id: "u9", name: "Yash Oberoi", photo: "https://i.pravatar.cc/300?img=59", email: "yash.oberoi@example.com", phone: "+91 91234 56780", coachId: "c7", packageName: "LeanR Advance", sessionsTotal: 24, sessionsUsed: 17, sessionsRemaining: 7, status: "active", joinedDate: "2025-12-22", streak: 9, goals: ["Athletic performance"], medicalNotes: "None reported.", equipment: ["Agility ladder", "Cones", "Dumbbells"] },
  { id: "u10", name: "Pooja Malhotra", photo: "https://i.pravatar.cc/300?img=26", email: "pooja.m@example.com", phone: "+91 98888 77665", coachId: "c8", packageName: "PT Add-on 12", sessionsTotal: 12, sessionsUsed: 0, sessionsRemaining: 12, status: "active", joinedDate: "2026-07-25", streak: 0, goals: ["Build the habit"], medicalNotes: "Complete beginner, no injuries.", equipment: ["None yet"] },
];

function iso(daysFromNow: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const sessions: Session[] = [
  { id: "s1", clientId: "u1", coachId: "c1", date: iso(0, 18, 30), durationMinutes: 45, type: "regular", status: "upcoming" },
  { id: "s2", clientId: "u1", coachId: "c1", date: iso(-2, 18, 30), durationMinutes: 45, type: "regular", status: "completed", remarks: "Strong session — increased squat load to 60kg for 5x5. Mobility in ankles improving. Homework: 10min daily calf stretch.", rating: 5, feedback: "Great energy today, felt strong!" },
  { id: "s3", clientId: "u1", coachId: "c1", date: iso(-5, 18, 30), durationMinutes: 45, type: "regular", status: "completed", remarks: "Focused on deadlift form. Lower back stayed neutral throughout — good control. Reduced weight slightly to groove the pattern.", rating: 4, feedback: "Good pace, could push harder next time." },
  { id: "s4", clientId: "u1", coachId: "c1", date: iso(-9, 18, 30), durationMinutes: 45, type: "regular", status: "completed", remarks: "First real strength session post-assessment. Baseline numbers recorded for squat, hinge, and press patterns.", rating: 5 },
  { id: "s5", clientId: "u1", coachId: "c1", date: iso(-12, 18, 0), durationMinutes: 60, type: "assessment", status: "completed", remarks: "Full movement screen completed. Mild anterior pelvic tilt noted. Cleared for progressive strength training with core-bracing cues.", rating: 5 },
  { id: "s6", clientId: "u1", coachId: "c1", date: iso(3, 18, 30), durationMinutes: 45, type: "regular", status: "upcoming" },
  { id: "s7", clientId: "u1", coachId: "c1", date: iso(-16, 18, 30), durationMinutes: 45, type: "regular", status: "missed" },
  { id: "s8", clientId: "u1", coachId: "c1", date: iso(-19, 18, 30), durationMinutes: 45, type: "regular", status: "cancelled" },
  { id: "s9", clientId: "u2", coachId: "c2", date: iso(0, 7, 0), durationMinutes: 45, type: "regular", status: "upcoming" },
  { id: "s10", clientId: "u3", coachId: "c1", date: iso(0, 20, 0), durationMinutes: 45, type: "regular", status: "upcoming" },
  { id: "s11", clientId: "u7", coachId: "c1", date: iso(0, 8, 0), durationMinutes: 60, type: "assessment", status: "upcoming" },
  { id: "s12", clientId: "u4", coachId: "c3", date: iso(1, 17, 0), durationMinutes: 45, type: "regular", status: "upcoming" },
  { id: "s13", clientId: "u6", coachId: "c4", date: iso(0, 19, 0), durationMinutes: 45, type: "regular", status: "upcoming" },
  { id: "s14", clientId: "u9", coachId: "c7", date: iso(0, 16, 0), durationMinutes: 45, type: "regular", status: "upcoming" },
  { id: "s15", clientId: "u2", coachId: "c2", date: iso(-1, 7, 0), durationMinutes: 45, type: "regular", status: "completed", remarks: "Great HIIT circuit, heart rate stayed in zone 4 for 80% of session.", rating: 5 },
  { id: "s16", clientId: "u3", coachId: "c1", date: iso(-1, 20, 0), durationMinutes: 45, type: "regular", status: "completed", remarks: "Shoulder feeling better — pain-free overhead press at light load.", rating: 4 },
];

export const packages: PackageTier[] = [
  {
    id: "p1",
    name: "LeanR Advance",
    category: "advance",
    sessions: 24,
    price: 45999,
    originalPrice: 54999,
    features: ["1:1 live PT included", "Custom nutrition plan", "Dedicated coach for full plan", "Weekly progress check-ins", "Priority scheduling"],
    highlighted: true,
  },
  {
    id: "p2",
    name: "PT Add-on — 12 Sessions",
    category: "addon",
    sessions: 12,
    price: 14999,
    features: ["1:1 live PT sessions", "Same coach throughout", "Flexible scheduling", "Session remarks & tracking"],
  },
  {
    id: "p3",
    name: "PT Add-on — 24 Sessions",
    category: "addon",
    sessions: 24,
    price: 27999,
    originalPrice: 31999,
    features: ["1:1 live PT sessions", "Same coach throughout", "Flexible scheduling", "Session remarks & tracking", "Free assessment session"],
    highlighted: true,
  },
  {
    id: "p4",
    name: "PT Add-on — 48 Sessions",
    category: "addon",
    sessions: 48,
    price: 51999,
    originalPrice: 59999,
    features: ["1:1 live PT sessions", "Same coach throughout", "Flexible scheduling", "Session remarks & tracking", "Free assessment session", "Monthly progress report"],
  },
];

export const testimonials: Testimonial[] = [
  { id: "t1", name: "Ishita Rao", photo: "https://i.pravatar.cc/300?img=32", quote: "Training live with Priya changed everything. I actually show up now because someone's expecting me on the other side of the screen.", result: "Lost 9kg in 5 months", coachName: "Priya Nair" },
  { id: "t2", name: "Aditya Verma", photo: "https://i.pravatar.cc/300?img=15", quote: "Having the same coach the whole way through meant Arjun actually knew my history — no re-explaining my shoulder issue every session.", result: "Gained 4kg lean muscle", coachName: "Arjun Mehta" },
  { id: "t3", name: "Neha Gupta", photo: "https://i.pravatar.cc/300?img=29", quote: "Rohan rebuilt my confidence after my ACL surgery. I never felt rushed, and every session was tailored to where I actually was that day.", result: "Full mobility restored", coachName: "Rohan Kapoor" },
];

export const notifications: NotificationItem[] = [
  { id: "n1", title: "Session confirmed", message: "Your session with Arjun Mehta is confirmed for today at 6:30 PM.", time: iso(0, 9, 0), type: "booking", read: false },
  { id: "n2", title: "Session reminder", message: "Your session starts in 30 minutes. Get your space and water ready!", time: iso(0, 6, 0), type: "reminder", read: false },
  { id: "n3", title: "How was your session?", message: "Rate your session with Arjun Mehta from July 27 and help us improve.", time: iso(-2, 20, 0), type: "feedback", read: true },
  { id: "n4", title: "Package renewed", message: "Your LeanR Advance package has been renewed. 24 sessions added.", time: iso(-10, 11, 0), type: "system", read: true },
  { id: "n5", title: "Coach change request update", message: "Our team is reviewing your coach change request. We'll notify you once resolved.", time: iso(-1, 15, 0), type: "system", read: true },
];

export const coachChangeRequests: CoachChangeRequest[] = [
  { id: "r1", clientId: "u4", currentCoachId: "c3", reason: "Scheduling conflict — need someone available on weekend mornings.", submittedDate: iso(-1, 10, 0), status: "pending" },
  { id: "r2", clientId: "u8", currentCoachId: "c6", reason: "Would prefer a coach with more availability for evening sessions.", submittedDate: iso(-3, 14, 0), status: "pending" },
  { id: "r3", clientId: "u5", currentCoachId: "c5", reason: "Looking for a different training style, more focused on conditioning.", submittedDate: iso(-8, 9, 0), status: "approved" },
];

export const adminMetrics = {
  totalClients: 342,
  activePTClients: 214,
  sessionsBookedToday: 47,
  sessionsCompletedToday: 22,
  sessionsCancelledToday: 3,
  trainerUtilization: 78,
  peakBookingHour: "6:00 PM – 8:00 PM",
  emptySlotCount: 34,
  revenueThisMonth: 3842500,
  avgSessionsPerClient: 16.4,
};

export const revenueTrend = [
  { month: "Feb", revenue: 2810000, sessions: 1120 },
  { month: "Mar", revenue: 3120000, sessions: 1240 },
  { month: "Apr", revenue: 2950000, sessions: 1190 },
  { month: "May", revenue: 3410000, sessions: 1360 },
  { month: "Jun", revenue: 3600000, sessions: 1425 },
  { month: "Jul", revenue: 3842500, sessions: 1510 },
];

export const bookingsByHour = [
  { hour: "6am", bookings: 12 },
  { hour: "8am", bookings: 22 },
  { hour: "10am", bookings: 15 },
  { hour: "12pm", bookings: 9 },
  { hour: "2pm", bookings: 11 },
  { hour: "4pm", bookings: 24 },
  { hour: "6pm", bookings: 41 },
  { hour: "8pm", bookings: 33 },
  { hour: "10pm", bookings: 10 },
];

export const utilizationByCoach = coaches.map((c) => ({ name: c.name.split(" ")[0], utilization: c.utilization }));

export function getCoach(id: string) {
  return coaches.find((c) => c.id === id);
}
export function getClient(id: string) {
  return clients.find((c) => c.id === id);
}
export function sessionsForClient(clientId: string) {
  return sessions.filter((s) => s.clientId === clientId);
}
export function sessionsForCoach(coachId: string) {
  return sessions.filter((s) => s.coachId === coachId);
}
