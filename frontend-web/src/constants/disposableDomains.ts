const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "guerrillamail.biz", "guerrillamail.de", "guerrillamail.info", "guerrillamailblock.com",
  "throwam.com", "throwam.net", "trashmail.com", "trashmail.me", "trashmail.net",
  "trashmail.io", "trashmail.at", "trashmail.xyz", "yopmail.com", "yopmail.fr",
  "cool.fr.nf", "jetable.fr.nf", "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj",
  "speed.1s.fr", "courriel.fr.nf", "moncourrier.fr.nf", "monemail.fr.nf",
  "monmail.fr.nf", "10minutemail.com", "10minutemail.net", "10minutemail.org",
  "10minutemail.de", "10minutemail.co.uk", "10minutemail.us", "10minutemail.info",
  "tempmail.com", "tempmail.net", "temp-mail.org", "temp-mail.ru", "tempinbox.com",
  "sharklasers.com", "guerrillamailblock.com", "grr.la", "guerrillamail.info",
  "spam4.me", "dispostable.com", "mailnull.com", "maildrop.cc", "spamgourmet.com",
  "spamgourmet.net", "spamgourmet.org", "spamhereplease.com", "spam.la",
  "binkmail.com", "bobmail.info", "chammy.info", "devnullmail.com", "letthemeatspam.com",
  "mailinater.com", "saintly.com", "spamhereplease.com", "spamthisplease.com",
  "thankyou2010.com", "thisisnotmyrealemail.com", "tradermail.info", "uggsrock.com",
  "fakeinbox.com", "fakeinbox.net", "mailnew.com", "discard.email", "discardmail.com",
  "discardmail.de", "spamfree24.org", "spamfree24.de", "spamfree24.eu", "spamfree24.info",
  "spamfree24.net", "spamfree.eu", "mailboxy.fun", "spamovici.com",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim() ?? "";
  return DISPOSABLE_DOMAINS.has(domain);
}
