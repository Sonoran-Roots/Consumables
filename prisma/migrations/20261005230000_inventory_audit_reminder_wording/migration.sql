-- Default wording for the overdue-findings reminder email (editable in settings).
-- Same table as the findings email: one row per template, keyed by id.
INSERT INTO "IaEmailTemplate" ("id", "subject", "intro", "footer", "updatedAt") VALUES (
  'reminder',
  'Reminder: {count} overdue inventory audit finding(s) for your team ({date})',
  E'Hi {managerName},\n\nThis is a reminder that the {count} inventory audit finding(s) below are past their due date and still open. Please correct each one and let us know when it is done, or reply if you need more time or help. You can also update a finding''s status directly in the audit tracker: {reportLink}\n',
  E'Thank you,\n{senderName}\nInventory Audit Team',
  CURRENT_TIMESTAMP
);
