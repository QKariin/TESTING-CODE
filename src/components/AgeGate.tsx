"use client";

import { useState, useEffect } from "react";

export default function AgeGate() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem("age_verified")) setShow(true);
    }, []);

    if (!show) return null;

    const confirm = () => {
        localStorage.setItem("age_verified", "1");
        setShow(false);
    };

    const deny = () => {
        window.location.href = "https://google.com";
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "rgba(0,0,0,0.92)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)",
            display: "flex", alignItems: "center", justifyContent: "center",
        }}>
            <div style={{
                textAlign: "center", padding: "48px 36px", maxWidth: 400,
                background: "rgba(6,6,10,0.85)", border: "1px solid rgba(197,160,89,0.12)",
                borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}>
                <div style={{
                    fontFamily: "Cinzel, serif", fontSize: "2.4rem", fontWeight: 700,
                    color: "rgba(197,160,89,0.8)", marginBottom: 8,
                }}>18+</div>
                <div style={{
                    fontFamily: "Cinzel, serif", fontSize: "0.85rem", fontWeight: 600,
                    color: "rgba(255,255,255,0.85)", letterSpacing: 3, marginBottom: 20,
                }}>ADULT CONTENT</div>
                <div style={{ width: 30, height: 1, background: "rgba(197,160,89,0.3)", margin: "0 auto 20px" }} />
                <p style={{
                    fontFamily: "Rajdhani, sans-serif", fontSize: "0.8rem",
                    color: "rgba(255,255,255,0.4)", lineHeight: 1.7, marginBottom: 32,
                }}>
                    This website contains adult content and is intended for individuals 18 years of age or older.
                    By entering, you confirm that you are of legal age in your jurisdiction.
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <button onClick={confirm} style={{
                        fontFamily: "Cinzel, serif", fontSize: "0.7rem", letterSpacing: 4,
                        color: "rgba(197,160,89,0.9)", padding: "14px 36px",
                        background: "rgba(197,160,89,0.08)", border: "1px solid rgba(197,160,89,0.25)",
                        borderRadius: 8, cursor: "pointer",
                    }}>I AM 18+</button>
                    <button onClick={deny} style={{
                        fontFamily: "Cinzel, serif", fontSize: "0.7rem", letterSpacing: 4,
                        color: "rgba(255,255,255,0.25)", padding: "14px 36px",
                        background: "none", border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 8, cursor: "pointer",
                    }}>LEAVE</button>
                </div>
            </div>
        </div>
    );
}
