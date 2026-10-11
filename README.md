# 1016 Technologies site

Static site (`public/`) plus one serverless function (`api/partner.js`) that emails partner enquiries.

## Deploy on Vercel
1. Put this folder in a GitHub repo (for example `1016-site`) and import it in Vercel. No build command is needed; Vercel reads `vercel.json`.
2. Project Settings > Environment Variables (Production):
   - `RESEND_API_KEY`  your key from resend.com
   - `NOTIFY_TO`       address that receives enquiries (comma separate for several)
   - `MAIL_FROM`       optional. Leave unset until the 1016tech.com domain is verified in Resend.
3. Project Settings > Domains: add `1016tech.com` and `www.1016tech.com`, then add the DNS records Vercel shows at the domain registrar.
4. Redeploy once after saving the variables.

## When the company email is ready
- Change `NOTIFY_TO` to the new address.
- In Resend, verify `1016tech.com`, then set `MAIL_FROM` to e.g. `1016 Partners <partners@1016tech.com>`.
- Add the address to the Partner page in `public/index.html` if you want it shown.

## Notes
- Resend's free sender (`onboarding@resend.dev`) only delivers to the email you signed up to Resend with.
- The form allows 5 sends per connection per 10 minutes and has a hidden spam trap.
- Fonts are Roslindale "Testing" files. Replace them with the licensed web fonts before wide launch.
