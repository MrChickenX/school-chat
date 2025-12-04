# school-chat

Lightweight E2EE multiuser chat (static frontend + minimal websocket relay).
This README explains how the system works, the cryptography, how to deploy the frontend to GitHub Pages and run the server on a VM (Oracle Cloud), and useful systemd / cloudflared examples.

## Overview

The project is split in two parts:

1. **Frontend** — ```index.html``` (static). Hosted on GitHub Pages (or any static host). Runs entirely in the browser and performs all cryptographic operations using the Web Crypto API.

2. **Server** — ```server.js``` (Node). Runs on your VM and acts as a **message relay / public-key store** via WebSockets. It forwards encrypted payloads and stores public keys — it does not see message plaintext (unless compromised).

High-level flow:

* Browser opens WebSocket to server (```ws://``` or ```wss://```).

* On connect server assigns an id and broadcasts the user list.

* Each client generates an ECDH keypair (P-256) locally and exports the public key.

* Public key is uploaded to server (for others to fetch).

* When sending a message: client derives a shared AES-GCM key via ECDH with peer's public key, encrypts the message (random IV), and sends the ciphertext to the server. Server forwards ciphertext to recipient. Recipient derives the same AES key and decrypts locally.

## Cryptography (what actually happens)

* **Key exchange:** ECDH using curve **P-256** (WebCrypto ```ECDH, namedCurve: 'P-256'```).

  * Each browser generates an ephemeral keypair (private key never leaves the browser).

  * The exported public key (raw -> base64) is sent to the server for distribution.

* **Symmetric key:** AES-GCM (256-bit) derived with ```crypto.subtle.deriveKey``` from ECDH shared secret.

* **Message encryption:** AES-GCM with a random 12-byte IV. Ciphertext = AES-GCM(iv || encrypted).

* **Public keys distribution:** server stores and returns public keys upon request. This is a trust point — the server could lie and substitute keys (MITM), so verify fingerprints for strong security if needed.

* **Privacy property:** Server only sees and forwards ciphertexts. However the server must be trusted for correct public-key distribution (or use out-of-band verification).

### Security notes / limitations

* The server is a *public key directory*. If the server is compromised it can substitute public keys and perform MitM. For production-grade E2EE you must verify key fingerprints or use a trusted PKI / identity layer.

* Quick-tunnel usage (trycloudflare) provides transport security for WebSocket (TLS), but does not change public-key trust assumptions.

* Private keys are stored in browser memory — if a user refreshes the page keys are regenerated (session scoped). You can change this to persist keys in ```localStorage``` if desired (tradeoff: persistence vs. forward secrecy).

Copyright (c) Alexander Kaufmann 2025
