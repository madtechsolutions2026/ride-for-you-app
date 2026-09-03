import request from 'supertest';
import app from '../../src/app';

/** `await api().get('/admin/api/stats').set(headers)` */
export const api = () => request(app);
