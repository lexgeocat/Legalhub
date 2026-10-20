import { GlobalWorkerOptions } from 'pdfjs-dist';
import trabajador from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = trabajador;

export * from 'pdfjs-dist';