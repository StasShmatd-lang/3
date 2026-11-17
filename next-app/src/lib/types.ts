export type MissionStatus = "draft" | "live" | "closed";

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type Mission = {
  id: string;
  text: string;
  refPhoto?: string;
};

export type Guest = {
  id: string;
  guestToken: string;
  name: string;
  createdAt: number;
};

export type Submission = {
  id: string;
  guestId: string;
  missionId: string;
  photo: string;
  status: SubmissionStatus;
  createdAt: number;
};

export type HuntEvent = {
  id: string;
  title: string;
  companyLogo?: string;
  hostToken: string;
  /** Shown only to host (via hostToken). Guests submit the plain key; server checks hash. */
  guestAccessKey: string;
  guestAccessKeyHash: string;
  screenToken: string;
  status: MissionStatus;
  missions: Mission[];
  guests: Guest[];
  submissions: Submission[];
  uploadBytesUsed: number;
  createdAt: number;
  updatedAt: number;
};

export type PublicMission = {
  id: string;
  text: string;
  refPhoto?: string;
};

export type HostState = {
  role: "host";
  eventId: string;
  title: string;
  companyLogo?: string;
  status: MissionStatus;
  guestAccessKey: string;
  screenToken: string;
  missions: Mission[];
  guestCount: number;
  uploadBytesUsed: number;
  uploadQuotaBytes: number;
  submissions: Array<
    Submission & {
      guestName: string;
      missionText: string;
    }
  >;
};

export type GuestState = {
  role: "guest";
  eventId: string;
  title: string;
  companyLogo?: string;
  status: MissionStatus;
  guestId: string;
  name: string;
  missions: PublicMission[];
  mySubmissions: Array<{
    id: string;
    missionId: string;
    status: SubmissionStatus;
    photo: string;
  }>;
};

export type ScreenState = {
  role: "screen";
  eventId: string;
  title: string;
  companyLogo?: string;
  status: MissionStatus;
  guestCount: number;
  approved: Array<{
    id: string;
    photo: string;
    guestName: string;
    missionText: string;
    createdAt: number;
  }>;
  joinPath: string;
};

export type PollState = HostState | GuestState | ScreenState;
