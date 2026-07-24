'use client';
import { useEffect } from 'react';

export default function PreviewTasks() {
    useEffect(() => {
        window.location.replace('/vault?preview=spin_wheel');
    }, []);
    return null;
}
