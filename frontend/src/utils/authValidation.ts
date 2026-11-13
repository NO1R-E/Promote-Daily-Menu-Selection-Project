export const EMAIL_MAX = 254;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 24; 
export const LOGIN_PASSWORD_MAX = 72;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
// 8-24 characters from: A-Z a-z 0-9 ! @ # $ & * _ + - = ?
export const PASSWORD_SPECIALS = "! @ # $ & * _ + - = ?";
const PASSWORD_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$&*_+\-=?])[A-Za-z0-9!@#$&*_+\-=?]{8,24}$/;
const GMAIL_RE = /^[^\s@]+@gmail\.com$/;

export const normalizeEmail = (v: string) => v.trim().toLowerCase();
export const normalizeUsername = (v: string) => v.trim();

export function validateEmail(raw: string): string | null {
  const email = normalizeEmail(raw);
  if (!email) return "Email is required.";
  if (email.length > EMAIL_MAX || !EMAIL_RE.test(email))
    return "Please enter a valid email address.";
  return null;
}

export function validateSignupEmail(raw: string): string | null {
  const base = validateEmail(raw);
  if (base) return base;
  if (!GMAIL_RE.test(normalizeEmail(raw))) return "Please use a Gmail address (@gmail.com).";
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
    return `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters with an uppercase letter, a lowercase letter, a number and a special character (${PASSWORD_SPECIALS}). Other characters and spaces are not allowed.`;
  if (password !== confirm) return "Passwords do not match.";
  return null;
}
