# ADR-003: Encryption Algorithm for Journal Entries

>**What:** encryption algo for encrypting db `raw_markdown` content
>**Status:** Decided  
>**Date:** 2025-12-03  
>**Outcome:** Fernet

## Note to self on terminology

New to this, when researching came across several terms I wasn't familiar with, note for future self below:
- symmetric encryption: same key for encrpytion & decruption
- AES: Advanced Encryption Standard, 
    - an algo, takes plaintext and a key, transforms into "ciphertext" in a process reversible only with same key
    - operates on blocks (chunks of the binary that make up the text, 16-bytes)
        - modes like CBC or GCM specify how to handle long messages
    - highly optimised in modern CPUs, hardware instructions exist for AES
    - for basic idea, see: https://www.youtube.com/watch?v=O4xNJsjtN6E
- HMAC: hash-based message authentication code
    - lets you prove a message has not been modified and confirm who created it, using shared key
    - sender hashes message with secret key and then sends encrypted message with hash
    - receiver then decrpts, and can re-hash using same key --> if hash is different, message modified / not generated with same key
- IV: initisation vector, e.g, for use in CBC for "mixing" block 0
- Nonce: number used once, like the seed for random process. Ensures same plaintext doesn't give the same ciphertext
- CBC: cipher block chaining
    - a mode for unning AES, when chaining messages >16bytes
    - each block mixed with previous one, so you don't get repeated patterns when you are encrypting repeated text (which could be exploited)
    - requires an IV
- GCM: Galois/Counter Mode, alternative to CBC, combines encryption and auth whereas cbc requires HMAC for auth



## Requirements

- Encrypt/decrypt `raw_markdown` field in journal entries before storing in / after reading from database
- Authenticated encryption (prevent tampering)
- Minimal latency impact
- Simple implementation and maintenance

## Options considered

### potentials

- Fernet
- AES-256-GCM

## Fernet

_Note: AI summary below, I didn't write this..._

**What it is:** Fernet is a symmetric encryption specification from the `cryptography` library that uses AES-128 in CBC mode with HMAC-SHA256 for authentication. It provides a simple, high-level API for authenticated encryption.

Pros:
- **Simple API** - Just `encrypt()` and `decrypt()` methods, no need to manage nonces/IVs manually
- **Built-in authentication** - HMAC prevents tampering automatically
- **Key rotation support** - Tokens include version info, making key rotation easier
- **Less error-prone** - Handles nonce/IV generation, padding, and authentication internally
- **Industry standard** - Widely used, well-tested, recommended by cryptography library maintainers
- **Secure** - Uses AES-128-CBC with HMAC-SHA256 (strong enough for this use case)
- **Fast enough** - Performance difference vs AES-256-GCM is negligible for journal entries (<1ms difference)
- **Base64 encoding** - Encrypted output is Base64-encoded, safe for db storage

Cons:
- **Slightly slower than raw AES-GCM** - Uses AES-128-CBC (not GCM), but difference is negligible for this use case
- **Fixed algorithm** - Less flexibility if we need to change encryption parameters

## AES-256-GCM

_Note: AI summary below, I didn't write this..._

**What it is:** AES-256-GCM (Galois/Counter Mode) is a symmetric authenticated encryption algorithm that provides both confidentiality and authenticity in a single operation.

Pros:
- **Slightly faster** - Raw AES-GCM can be marginally faster than Fernet's AES-128-CBC
- **More control** - Can customize encryption parameters if needed
- **Industry standard** - Widely used, well-tested algorithm

Cons:
- **More complex implementation** - Need to manually manage nonces/IVs (initialization vectors)
- **Error-prone** - Easy to make mistakes with nonce generation/reuse
- **More code** - Requires more boilerplate for proper nonce handling
- **No built-in key rotation** - Would need to implement versioning ourselves
- **Performance gain is minimal** - For journal entries (typically <100KB), the difference is <1ms

## Conclusion

going with Fernet, difference in this use case feels extremely marginal with AES-256-GCM, given amount of additional effort required.

