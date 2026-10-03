// BOD members, volunteers, speakers etc. who need a pass. Someone who is also
// a paid registrant keeps their real ticket and is just flagged is_team;
// someone who isn't a registrant at all gets a generated ticket number that
// starts with TEAM- (so it can't collide with a registration ticket).

export const TEAM_PREFIX = "TEAM-";

// No 0/O/1/I so a ticket number read out loud or typed can't be misread.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newTeamTicket() {
  let s = TEAM_PREFIX;
  for (let i = 0; i < 5; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

const TYPE_MAP: Record<string, string> = {
  bod: "BOD",
  board: "BOD",
  volunteer: "Volunteer",
  volunteers: "Volunteer",
  speaker: "Speaker",
  organiser: "Organiser",
  organizer: "Organiser",
  guest: "Guest",
  sponsor: "Sponsor",
  media: "Media",
  team: "Team",
};

export interface TeamRow {
  name: string;
  email: string;
  type: string;
}

/**
 * One person per line: "Name, email, role" (comma, semicolon or tab). The
 * role is optional (defaults to "Team"); the email can be in any position.
 */
export function parseTeamLines(text: string): { rows: TeamRow[]; errors: string[] } {
  const rows: TeamRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.split(/\t|,|;/).map((p) => p.trim()).filter(Boolean);

    const email = parts.find((p) => /^\S+@\S+\.\S+$/.test(p))?.toLowerCase();
    if (!email) {
      errors.push(`Line ${i + 1}: no valid email ("${line.slice(0, 40)}")`);
      return;
    }
    const rest = parts.filter((p) => p.toLowerCase() !== email);
    const name = rest[0]?.replace(/\s+/g, " ").slice(0, 120);
    if (!name) {
      errors.push(`Line ${i + 1}: no name next to ${email}`);
      return;
    }
    if (seen.has(email)) {
      errors.push(`Line ${i + 1}: ${email} appears more than once`);
      return;
    }
    seen.add(email);

    const roleText = rest[1];
    const type = roleText
      ? (TYPE_MAP[roleText.toLowerCase()] ?? roleText.slice(0, 20))
      : "Team";
    rows.push({ name, email, type });
  });

  return { rows, errors };
}
