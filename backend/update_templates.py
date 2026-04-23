import asyncio
from app.database import close_database_connection, connect_to_database, get_db

BEAUTIFUL_TEMPLATE = """<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <div style="background-color: #0F766E; padding: 30px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Payment Receipt</h1>
  </div>
  <div style="padding: 30px; background-color: #ffffff;">
    <p style="font-size: 16px; color: #374151; margin-top: 0;">Hello <strong>{{payerName}}</strong>,</p>
    <p style="font-size: 16px; color: #374151; line-height: 1.5;">Thank you for your payment! We have successfully received your payment for <strong>{{pageTitle}}</strong>.</p>
    
    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
      <h2 style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Payment Details</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #4b5563; font-size: 15px;">Amount Paid:</td>
          <td style="padding: 8px 0; color: #111827; font-size: 15px; font-weight: 600; text-align: right;">{{amount}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #4b5563; font-size: 15px;">Date:</td>
          <td style="padding: 8px 0; color: #111827; font-size: 15px; text-align: right;">{{date}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #4b5563; font-size: 15px; border-bottom: none;">Transaction ID:</td>
          <td style="padding: 8px 0; color: #111827; font-size: 15px; text-align: right; font-family: monospace;">{{transactionId}}</td>
        </tr>
      </table>
    </div>
    
    <p style="font-size: 14px; color: #6b7280; margin-bottom: 0;">If you have any questions about this receipt, please contact support.</p>
  </div>
  <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="font-size: 12px; color: #9ca3af; margin: 0;">Powered by Waystar Quick Payment Pages</p>
  </div>
</div>"""

async def main() -> None:
    await connect_to_database()
    db = get_db()

    print("Updating all existing payment pages with the new beautiful template...")
    result = await db.payment_pages.update_many(
        {}, 
        {"$set": {"email_template": BEAUTIFUL_TEMPLATE}}
    )
    print(f"Updated {result.modified_count} payment pages!")
    
    await close_database_connection()

if __name__ == "__main__":
    asyncio.run(main())
