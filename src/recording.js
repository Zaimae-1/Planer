import { useEffect, useRef, useState } from 'react';

export function useRecording(onFile, onError) {
  const active = useRef(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  const [started, setStarted] = useState(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const current = active.current;
      if (current) {
        current.cancelled = true;
        current.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!started) return;
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setSeconds(elapsed);
      if (elapsed >= 300 && active.current?.recorder.state === 'recording') active.current.recorder.stop();
    }, 250);
    return () => clearInterval(timer);
  }, [started]);

  async function record() {
    if (pending.current || active.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      onError('Rekaman membutuhkan browser yang mendukung mikrofon dan koneksi HTTPS atau localhost.');
      return;
    }
    pending.current = true;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const session = { recorder, stream, cancelled: false };
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        session.cancelled = true;
        if (mounted.current) onError('Rekaman gagal. Coba lagi.');
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (active.current === session) active.current = null;
        if (!mounted.current) return;
        setStarted(null);
        if (session.cancelled) return;
        const type = recorder.mimeType || chunks[0]?.type || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        onFile(new File(chunks, `Pesan suara.${ext}`, { type }));
      };
      recorder.start();
      active.current = session;
      setSeconds(0);
      setStarted(Date.now());
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      if (mounted.current) onError('Mikrofon belum bisa diakses. Periksa izin mikrofon di browser.');
    } finally {
      pending.current = false;
    }
  }

  function stop(cancelled = false) {
    const session = active.current;
    if (!session || session.recorder.state === 'inactive') return;
    session.cancelled = cancelled;
    session.recorder.stop();
  }

  return { record, stop, recording: Boolean(started), seconds };
}
