"use server";

import { ActionResult, runAction } from "./action-result";
import { sendPhoneOtp, verifyPhoneOtp } from "@/lib/services/sms.service";

/** Deliberately don't require a session for these two -- SignupForm.tsx
 * calls sendPhoneOtpAction/verifyPhoneOtpAction for a brand-new signup
 * before or right as a session is established (mid email-OTP step), and
 * PhoneGateModal.tsx calls them for an already-authenticated Google
 * sign-in. Verifying a code proves ownership of the *phone number*, not
 * the caller's identity -- the actual profiles.phone write only happens
 * afterward, via setMyPhoneAction (client-profile.actions.ts), which does
 * require a session. */

export async function sendPhoneOtpAction(phone: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const sent = await sendPhoneOtp(phone);
    if (!sent) throw new Error("Couldn't send a verification code to that number -- double-check it, or SMS may not be configured yet.");
    return null;
  });
}

export async function verifyPhoneOtpAction(phone: string, otp: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const verified = await verifyPhoneOtp(phone, otp);
    if (!verified) throw new Error("That code didn't match -- check it and try again.");
    return null;
  });
}
