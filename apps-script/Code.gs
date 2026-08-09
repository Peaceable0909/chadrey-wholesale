/**
 * Chadrey Wholesale — Apps Script email relay (starter scaffold)
 *
 * Deploy as a Web App:
 *   Deploy > New deployment > type "Web app"
 *   Execute as: Me
 *   Who has access: Anyone
 * Copy the resulting /exec URL into the Worker's APPS_SCRIPT_WEBHOOK_URL secret.
 *
 * Set the matching shared secret in Script Properties:
 *   Project Settings > Script Properties > add SHARED_SECRET
 * (must match APPS_SCRIPT_SHARED_SECRET set on the Worker)
 */

const ADMIN_EMAIL = "orders@chadrey.example"; // <-- replace with the real inbox

function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  const expectedSecret = props.getProperty("SHARED_SECRET");
  const providedSecret = e.parameter.secret || (e.postData && JSON.parse(e.postData.contents).secret);

  // Simple shared-secret check via header isn't directly readable in Apps Script,
  // so the Worker also includes it in the JSON body as a fallback — check that too.
  const payload = JSON.parse(e.postData.contents);

  if (expectedSecret && payload.secret !== expectedSecret) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "bad secret" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const { type, ref, to, record } = payload;

  if (type === "quote_request_received") {
    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: `New quote request ${ref}`,
      body: `New quote request received.\n\nRef: ${ref}\nProduct: ${record.product}\nQty: ${record.qty}\nCustomer: ${record.company} (${record.email}, ${record.phone})\nAddress: ${record.address}\n\nReview it in the admin dashboard.`,
    });
    if (to) {
      MailApp.sendEmail({
        to,
        subject: `We've received your quote request — ${ref}`,
        body: `Thanks — we've received your request (${ref}) and will follow up with a preliminary quotation within 1-2 business days.`,
      });
    }
  }

  if (type === "quotation_sent" && to) {
    MailApp.sendEmail({
      to,
      subject: `Your quotation is ready — ${ref}`,
      body: `Your preliminary quotation for ${ref} is ready. Estimated unit price: ${record.quotation.unitPrice}. Log in to view the full quotation and accept it.`,
    });
  }

  if (type === "invoice_sent" && to) {
    MailApp.sendEmail({
      to,
      subject: `Your invoice is ready — ${ref}`,
      body: `Your invoice for ${ref} has been issued. Log in to view the full breakdown and proceed to payment.`,
    });
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
