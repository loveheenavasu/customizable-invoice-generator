// Make sure tests never talk to real services, whatever is in the shell env.
for (const key of Object.keys(process.env)) {
  if (key.startsWith("SUPABASE_") || key.startsWith("SMTP_") || key.startsWith("EMAIL_")) {
    delete process.env[key];
  }
}
