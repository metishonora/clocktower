import type { ScenarioJinx } from '../core/scenarioJinxes.js';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { preparedPdf, referencePdfInput } from './referencePdfCache.js';
GlobalWorkerOptions.workerSrc = workerUrl;

// Keep only the most recent rendered document. Reopening it does not encode or paint again.
let lastPreview: { key: string; bytes: Uint8Array; canvases: HTMLCanvasElement[] } | undefined;

export function DocumentPreview({ name, ids, jinxes, onClose }: { name: string; ids: string[]; jinxes: ScenarioJinx[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [count, setCount] = useState(0);
  const [firstPageReady, setFirstPageReady] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog.current?.showModal(); document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    let cancelled = false, url = '';
    let loading: ReturnType<typeof getDocument> | undefined;
    let rendering: { cancel: () => void } | undefined;
    const started = performance.now();
    setError(''); setPdfUrl(''); setCount(0); setFirstPageReady(false); preview.current?.replaceChildren();
    const showDownload = (bytes: Uint8Array) => {
      url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' }));
      setPdfUrl(url);
      performance.measure('reference-pdf:download-ready', { start: started, end: performance.now() });
    };
    void (async () => {
      const request = referencePdfInput(name, ids, jinxes);
      if (lastPreview?.key === request.key) {
        preview.current?.replaceChildren(...lastPreview.canvases);
        setCount(lastPreview.canvases.length); setFirstPageReady(true); showDownload(lastPreview.bytes);
        performance.measure('reference-pdf:first-page', { start: started, end: performance.now() });
        performance.measure('reference-pdf:ready', { start: started, end: performance.now() });
        return;
      }
      const bytes = await preparedPdf(request);
      if (cancelled) return;
      showDownload(bytes);
      const renderStarted = performance.now();
      loading = getDocument({ data: bytes.slice() });
      const pdf = await loading.promise;
      if (cancelled) return;
      setCount(pdf.numPages);
      const canvases: HTMLCanvasElement[] = [];
      for (let index = 1; index <= pdf.numPages; index++) {
        if (cancelled) return;
        const page = await pdf.getPage(index);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        canvas.className = 'scenarioReferencePdfCanvas'; canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `${name}, ${index} / ${pdf.numPages}쪽`);
        const task = page.render({ canvas, viewport, background: '#ffffff' }); rendering = task;
        await task.promise; rendering = undefined;
        if (cancelled) return;
        canvases.push(canvas); preview.current?.append(canvas); page.cleanup();
        if (index === 1) {
          setFirstPageReady(true);
          performance.measure('reference-pdf:first-page', { start: started, end: performance.now() });
        }
        // Let the browser paint this page before preparing the next one.
        if (index < pdf.numPages) await new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
      }
      lastPreview = { key: request.key, bytes, canvases };
      performance.measure('reference-pdf:render', { start: renderStarted, end: performance.now() });
      performance.measure('reference-pdf:ready', { start: started, end: performance.now() });
      await loading.destroy(); loading = undefined;
    })().catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : '문서를 만들지 못했습니다.'); });
    return () => { cancelled = true; rendering?.cancel(); if (url) URL.revokeObjectURL(url); void loading?.destroy(); };
  }, [ids, name, jinxes, retry]);
  return <dialog className="scenarioReferenceDocumentDialog" ref={dialog} onCancel={onClose} aria-labelledby="document-title" data-page-count={count}>
    <header className="scenarioReferenceDocumentToolbar"><div><h2 id="document-title">{name}</h2><span>{count ? `직업 일람 · A4 · ${count}쪽` : '직업 일람 준비 중…'}</span></div><div>
      {pdfUrl ? <a className="scenarioReferenceOpenPdf" href={pdfUrl} target="_blank" rel="noopener noreferrer">인쇄 / PDF 저장</a> : <button type="button" disabled>인쇄 / PDF 저장</button>}
      <button type="button" className="scenarioReferenceClose" onClick={onClose} aria-label="미리보기 닫기">×</button></div></header>
    {error && <div className="scenarioReferencePdfError" role="alert">문서를 준비하지 못했습니다.<button onClick={() => setRetry(value => value + 1)}>다시 시도</button></div>}
    {!firstPageReady && !error && <p className="scenarioReferencePdfStatus" role="status">직업 일람을 만들고 있습니다…</p>}
    <div className="scenarioReferenceDocumentScroll" ref={preview}/>
  </dialog>;
}
