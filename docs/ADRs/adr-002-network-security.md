# ADR-002: Network Security Approach

>**What:** Network security strategy for GCP deployment, specifically how to secure cr backend API and db connections  
>**Status:** Decided
>**Date:** 2025-12-03  
>**Outcome:** Using application-level security stack (CORS restrictions + JWT token validation) with unauthenticated Cloud Run access. OpenVPN option considered for future IP-based restrictions.

## Requirements

- secure backend API access (only frontend and authorized users/IPs (me at home basically))
- secure database connections from cr backend
- db connection from single IP address for whitelisting (if database provider allows it for free, Neon doesn't, Aiven does)
- near-zero additional cost (free or minimal cost for single-user scale)
- maintain security best practices

## Options considered

### considered and immediately rejected

- **Cloud NAT with static IP for database connections:**
    - Provides static outbound IP for cr → db whitelisting
    - Cost: ~$35/month constant (NAT gateway ~$32/month + IP ~$3.60/month)
    - Rejected: Constant cost regardless of usage, too expensive!!
- **Reserved static IP without NAT:**
    - Cannot be directly assigned to cr (requires NAT gateway)
    - Would still need Cloud NAT infrastructur
    - Rejected: Doesn't solve the cost problem
- **Cloud SQL with private IP:**
    - Would require migrating from external DB (Neon/Aiven)
    - Private IP connectivity within VPC
    - Cost: Cloud SQL instance (~$7-15/month)
    - Trade-off: Higher DB cost but no NAT gateway needed
    - basically already ruled this out in [adr-001](./adr-001-db-choice.md), but reconsidering here
- **Compute Engine VM proxy:**
    - Small VM with static IP as database proxy
    - Cost: f1-micro (~$6/month) + static IP (~$2.88/month) = ~$9/month
    - Trade-off: More complexity, but lower cost than Cloud NAT
    - basically already ruled this out in [adr-001](./adr-001-db-choice.md) when I thought about running the DB in a VM I managed myself, but reconsidering here. Similar thing, running something myself in a VM in GCP rather than using GCP product for it

### potentials

- **Application-level security stack (CORS + JWT) - CHOSEN:**
    - CORS restrictions (primary protection)
    - JWT token validation
    - SSL/TLS encryption
    - Security headers middleware
    - Application-level IP filtering middleware (optional)
    - Strong db auth
- **Cloudflare (free tier):**
    - Proxy frontend through Cloudflare
    - IP access rules to restrict API access
    - Free tier includes basic IP filtering
- **OpenVPN - FUTURE CONSIDERATION:**
    - Self-hosted VPN server
    - Connect via VPN before accessing frontend
    - All requests come from VPN IP (can be whitelisted)

## Application-level security stack (CORS + JWT)


Pros:
- **Free** - no additional infrastructure costs
- **CORS restrictions** - Only whitelisted frontend origins can make requests (browser-enforced)
- **JWT token validation** - All protected API endpoints require valid JWT tokens
- **SSL/TLS encryption** - Automatic encryption for all data in transit (automatic with cr)
- **Security headers** - X-Frame-Options, CSP, etc. to prevent common vulnerabilities
- **Application-level IP filtering** - Optional middleware to filter by IP addresses (won't be configured but allows for future work with OpenVPN)
- **Strong database authentication** - SSL connections with strong passwords
- **Simple architecture** - No additional infrastructure to maintain (as there is with OpenVPN stuff..)

Cons:
- **No infrastructure-level IP whitelisting** - Cannot provide static IP for db whitelisting for extra security
- **Unauthenticated Cloud Run access required** - Browsers need unauthenticated access. But still have JWT auth protection
- **Relies on application-level controls** - CORS can be bypassed by non-browser clients (but JWT still required)
- **IP filtering based on headers** - Can be spoofed if requests don't go through Cloud Run's load balancer, but don't think this is actually an issue as all traffic to my cr must go via google's lb (automatic for any cr)

## Cloudflare (free tier)

**Note:** This option requires a custom domain. Currently using direct Cloud Storage URLs (`storage.googleapis.com/bucket-name`), so Cloudflare would only be relevant in future if I decide to register (and pay for) a custom domain for this, which I don't rule out, but don't plan to do.

Pros:
- **Free tier** - 100,000 requests/day, basic IP filtering
- **Free DNS hosting** - Cloudflare provides free DNS (no GCP DNS costs)
- **IP access rules** - Can restrict API access by IP at the edge
- **CDN benefits** - Better performance, DDoS protection
- **No VPN required** - Works from anywhere, just behind Cloudflare

Cons:
- **Requires custom domain** - Need to register a domain (~$10-15/year) to use Cloudflare
- **DNS changes required** - Need to point custom domain to Cloudflare (but DNS hosting is free)
- **Additional dependency** - Another service to manage
- **Free tier limits** - May need paid tier if traffic grows
- **Still need CORS + JWT** - Cloudflare adds IP layer, but API security still needed
- **Not applicable if using direct Storage URLs** - Only works with custom domains, not `storage.googleapis.com` URLs

## OpenVPN - Future consideration

Pros:
- **Free** - If self-hosted on small VM
- **IP-based restriction** - All requests come from VPN IP (can be whitelisted)
- **Full control** - You manage the VPN server
- **Works with existing IP filtering** - Can use `allowed-ips` secret with VPN IP

Cons:
- **Additional infrastructure / time to maintain** - Need to maintain VPN server
- **Mobile access harder** - VPN setup on mobile is more complex


## Conclusion

**Short-term decision:** Using application-level security stack with CORS + JWT validation.

1. **Unauthenticated Cloud Run access** - Required for browsers to reach the service
2. **CORS restrictions** - Primary protection: Only whitelisted frontend origins can make requests (browser-enforced)
3. **JWT token validation** - All protected API endpoints require valid JWT tokens obtained via Google OAuth
4. **SSL/TLS encryption** - Automatic encryption for all data in transit
5. **Security headers middleware** - X-Frame-Options, CSP, etc. to prevent common vulnerabilities
6. **Application-level IP filtering** - Optional middleware (disabled by default, can be enabled via `allowed-ips` secret for future use..)
7. **Strong database authentication** - SSL connections with strong passwords

This approach is free, simple, and sufficient for now. CORS ensures only requests from the frontend domain are allowed, and JWT tokens protect all API endpoints.

**Future considerations:** for additional IP-based security restrictions later, I can layer on a self-hosted free-plan OpenVPN.

