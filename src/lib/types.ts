export type SessionStatus = "upcoming" | "completed" | "cancelled" | "missed";
export type SessionType = "assessment" | "regular";

export interface Coach {
  id: string;
  name: string;
  photo: string;
  specialization: string;
  secondarySpecializations: string[];
  yearsExperience: number;
  rating: number;
  reviewCount: number;
  bio: string;
  certifications: string[];
  languages: string[];
  activeClients: number;
  utilization: number;
  status: "active" | "inactive" | "on-leave";
}

export interface Client {
  id: string;
  name: string;
  photo: string;
  email: string;
  phone: string;
  coachId: string;
  packageName: string;
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  status: "active" | "inactive" | "paused";
  joinedDate: string;
  streak: number;
  goals: string[];
  medicalNotes: string;
  equipment: string[];
}

export interface Session {
  id: string;
  clientId: string;
  coachId: string;
  date: string; // ISO datetime
  durationMinutes: number;
  type: SessionType;
  status: SessionStatus;
  remarks?: string;
  rating?: number;
  feedback?: string;
}

export interface PackageTier {
  id: string;
  name: string;
  category: "advance" | "addon";
  sessions: number;
  price: number;
  originalPrice?: number;
  features: string[];
  highlighted?: boolean;
}

export interface Testimonial {
  id: string;
  name: string;
  photo: string;
  quote: string;
  result: string;
  coachName: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: "booking" | "reminder" | "feedback" | "system";
  read: boolean;
}

export interface CoachChangeRequest {
  id: string;
  clientId: string;
  currentCoachId: string;
  reason: string;
  submittedDate: string;
  status: "pending" | "approved" | "rejected";
}
