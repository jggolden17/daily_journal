# ADR-001: Managed DB service

>**What:** the service I'll be using to host/manage my postgres DB
>**Status:** Decided  
>**Date:** 2025-11-30  
>**Outcome:** using Neon for intial dev with plans to migrate to Aiven before I actually use this, once networking in GCP set up

## Requirements

- small memory requirement (~<1GB)
- only I will be using it, low concurrency required
- free / negligible cost
- little to no effort to maintain once set up
- relatively quick to set up (not required to build my own monitoring etc.)
- minimal lock-in, easy to migrate to a different provider
- secure (e.g., ideally I can restrict access to whitelisted IPs)

## Options considered

### considered and immediately rejected

- [GCP CloudSQL](https://cloud.google.com/sql):
    - immediately ruled out on basis of cost, as I need to pay to constantly have it running, so looking at minimum something close to $10/mo.
- Self-managed in a VM in GCP:
    - similarly, the cost of having the machine constantly running is the killer
    - I'm interested in setting up in future as a learning exercise, but not worth it for this project

### potentials

Managed services that offer completely free options
- [NeonDB](https://neon.com/)
- [Aiven](https://aiven.io/)


## NeonDB

Pros:
- free plan up to 0.5GB, sufficient
    - cheap because they separate compute & storage --> scales easily & very cheap (scaling not acc relevant for project this size, given free tier, but cool conceptually)
- lots of other useful features (e.g. branching, restores, etc.) that would be fantastic in a more complex project but are less relevant for this

Cons:
- For ability to restrict access to whitelisted IPs, need to pay $5/mo min
- Minor cold-start latency, really not an issue for project this size

## Aiven

Pros:
- free plan up to 1GB of storage
    - unsure why/how they allow this free storage, but 
- free to restrict access to whitelisted IPs

Cons:
- No connection pooling, max 20 connections (not an issue for projec tthis size)

## Conclusion

For a "proper" project I would prefer Neon, but given the importance of security in this project I think it's essential that I can restrict access to the DB to whitelisted IPs. 

I haven't yet set any of the networking up in GCP, the only data I have is for testing (not sensitve), and I'm interested in Neon anyway. So I'll initially use it for dev purposes. 

But I'll plan to migrate to use Aiven as the only option I can find with a free tier that lets me restrict access to whitelisted IPs.