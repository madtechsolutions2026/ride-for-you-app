import { describe, it, expect } from 'vitest';
import { errMsg } from './errors';

/* Regression guard for the "Save failed" bug: the backend answers with
   { error } on most paths and { message } on a few, and reading only one
   of them hid the real reason from the operator. */

describe('errMsg', () => {
  it('prefers data.error, which is what most of the backend returns', () => {
    const err = { response: { data: { error: 'Employee with this phone already exists' } } };
    expect(errMsg(err, 'Save failed')).toBe('Employee with this phone already exists');
  });

  it('falls back to data.message for the endpoints that use that shape', () => {
    const err = { response: { data: { message: 'Employee added successfully' } } };
    expect(errMsg(err, 'Save failed')).toBe('Employee added successfully');
  });

  it('prefers error over message when a response carries both', () => {
    const err = { response: { data: { error: 'real reason', message: 'generic' } } };
    expect(errMsg(err, 'Save failed')).toBe('real reason');
  });

  it('uses the axios message when the request never got a response', () => {
    expect(errMsg({ message: 'Network Error' }, 'Save failed')).toBe('Network Error');
  });

  it('falls back to the supplied default when the error is empty or malformed', () => {
    expect(errMsg({}, 'Save failed')).toBe('Save failed');
    expect(errMsg(null, 'Save failed')).toBe('Save failed');
    expect(errMsg({ response: { data: {} } }, 'Save failed')).toBe('Save failed');
    expect(errMsg({ response: { data: null } }, 'Save failed')).toBe('Save failed');
  });

  it('ignores an empty-string error rather than returning a blank alert', () => {
    expect(errMsg({ response: { data: { error: '' } } }, 'Save failed')).toBe('Save failed');
  });
});
