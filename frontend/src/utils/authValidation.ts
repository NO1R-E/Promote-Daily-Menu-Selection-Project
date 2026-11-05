export const EMAIL_MAX = 254;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // bcrypt only uses the first 72 bytes

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

export const normalizeEmail = (v: string) => v.trim().toLowerCase();
export const normalizeUsername = (v: string) => v.trim();

export function validateEmail(raw: string): string | null {
  const email = normalizeEmail(raw);
  if (!email) return "Email is required.";
  if (email.length > EMAIL_MAX || !EMAIL_RE.test(email))
    return "Please enter a valid email address.";
  return null;
}

export function validateUsername(raw: string): string | null {
  const name = normalizeUsername(raw);
  if (!name) return "Username is required.";
  if (!USERNAME_RE.test(name))
    return `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters and can only contain letters, numbers and underscores.`;
  return null;
}

export function validateNewPassword(password: string, confirm: string): string | null {
  if (!password) return "Password is required.";
  if (password.length > PASSWORD_MAX)
    return `Password must be at most ${PASSWORD_MAX} characters.`;
  if (!PASSWORD_RE.test(password))
    return `Password must be at least ${PASSWORD_MIN} characters and contain both letters and numbers.`;
  if (password !== confirm) return "Passwords do not match.";
  return null;
}
