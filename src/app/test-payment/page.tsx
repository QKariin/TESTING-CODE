'use client';
import { useState } from 'react';
import PaymentModal from '@/components/PaymentModal';

export default function TestPayment() {
    const [show, setShow] = useState(true);

    return (
        <>
            {!show && (
                <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <button onClick={() => setShow(true)} style={{ padding: '16px 32px', background: 'rgba(197,160,89,0.1)', border: '1px solid rgba(197,160,89,0.3)', color: '#c5a059', fontFamily: 'Orbitron,sans-serif', fontSize: '0.6rem', letterSpacing: 4, cursor: 'pointer', borderRadius: 8 }}>
                        OPEN PAYMENT MODAL
                    </button>
                </div>
            )}
            {show && (
                <PaymentModal
                    amountEur={49}
                    label="SPECIAL TRIBUTE"
                    cardBody={{ memberId: 'test@test.com', amount: 49 }}
                    cryptoApiPath="/api/paywall/passimpay"
                    cryptoStatusApiPath="/api/paywall/passimpay-status"
                    cryptoPayBody={{ memberId: 'test@test.com', amount: 49 }}
                    cryptoStatusBody={{ memberId: 'test@test.com' }}
                    confirmMessage="✓ PAYMENT CONFIRMED — UNLOCKING..."
                    throneUrl="https://throne.com/queenkarin"
                    onSuccess={() => setShow(false)}
                    onClose={() => setShow(false)}
                />
            )}
        </>
    );
}
