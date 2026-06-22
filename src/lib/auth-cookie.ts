export interface UserSession {
  email: string;
  name?: string;
  picture?: string;
  expiry: number;
}

const SESSION_SECRET = process.env.SESSION_SECRET || "default-very-long-fallback-secret-key-for-portal-session-signing-12345";

/**
 * Encrypts and cryptographically signs user session payload.
 * Returns a JWT-like string: Base64(Payload).Hex(HMAC-SHA256(Payload))
 */
export async function createSessionCookie(payload: Omit<UserSession, "expiry">): Promise<string> {
  const session: UserSession = {
    ...payload,
    expiry: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days expiration
  };
  
  const dataStr = JSON.stringify(session);
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SESSION_SECRET);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(dataStr)
  );
  
  const hexSignature = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  
  // Use URL-safe Base64 encoding
  const base64Data = btoa(unescape(encodeURIComponent(dataStr)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
    
  return `${base64Data}.${hexSignature}`;
}

/**
 * Verifies signature of session token and checks expiration.
 * Returns verified session or null if invalid/expired.
 */
export async function verifySessionCookie(cookieValue: string): Promise<UserSession | null> {
  if (!cookieValue) return null;
  
  try {
    const parts = cookieValue.split(".");
    if (parts.length !== 2) return null;
    
    const [base64Data, hexSignature] = parts;
    
    // Decode URL-safe Base64
    let pad = "";
    const mod = base64Data.length % 4;
    if (mod === 2) pad = "==";
    else if (mod === 3) pad = "=";
    const base64Standard = (base64Data + pad).replace(/-/g, "+").replace(/_/g, "/");
    const dataStr = decodeURIComponent(escape(atob(base64Standard)));
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(SESSION_SECRET);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    
    // Convert hex signature back to bytes
    const signatureBytes = new Uint8Array(
      hexSignature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    
    const isValid = await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      signatureBytes,
      encoder.encode(dataStr)
    );
    
    if (!isValid) {
      console.warn("Session validation failed: signature mismatch");
      return null;
    }
    
    const session = JSON.parse(dataStr) as UserSession;
    if (session.expiry < Date.now()) {
      console.warn("Session validation failed: token expired");
      return null;
    }
    
    return session;
  } catch (err) {
    console.error("Error verifying session cookie:", err);
    return null;
  }
}

/**
 * Checks if a given email is listed in ADMIN_EMAILS environment variable
 */
export function isAdminEmail(email: string): boolean {
  const adminEmailsStr = process.env.ADMIN_EMAILS || "";
  if (!adminEmailsStr) return false;
  
  const adminEmails = adminEmailsStr
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
    
  return adminEmails.includes(email.trim().toLowerCase());
}
