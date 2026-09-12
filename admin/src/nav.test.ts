import { describe, it, expect } from 'vitest';
import { NAV, NAV_ITEMS, itemForPath, pathForScreen } from './nav';
import { ROLE_DEFAULT_SCREENS } from './context/AuthContext';

describe('nav structure', () => {
  it('has unique ids and unique paths', () => {
    const ids = NAV_ITEMS.map((i) => i.id);
    const paths = NAV_ITEMS.map((i) => i.path);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  /* This is the invariant that was actually broken: 'support' was missing
     from every role, so Support Helpdesk could never render. An ADMIN must
     be able to open every screen the sidebar offers. */
  it('grants ADMIN every screen present in the sidebar', () => {
    const missing = NAV_ITEMS.map((i) => i.id).filter(
      (id) => !ROLE_DEFAULT_SCREENS.ADMIN.includes(id),
    );
    expect(missing).toEqual([]);
  });

  it('only references screens that some role can be granted', () => {
    const known = new Set(Object.values(ROLE_DEFAULT_SCREENS).flat());
    for (const item of NAV_ITEMS) expect(known).toContain(item.id);
  });

  it('nests every sub-tab under its own item path, so the header resolves', () => {
    for (const item of NAV_ITEMS) {
      for (const tab of item.tabs ?? []) {
        expect(tab.path.startsWith(item.path + '/')).toBe(true);
      }
    }
  });

  it('gives every item a title and a subtitle for the header', () => {
    for (const item of NAV_ITEMS) {
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.subtitle.length).toBeGreaterThan(0);
    }
  });

  it('puts every item in exactly one section', () => {
    const flat = NAV.flatMap((s) => s.items);
    expect(flat).toHaveLength(NAV_ITEMS.length);
  });
});

describe('itemForPath', () => {
  it('matches an exact path', () => {
    expect(itemForPath('/dashboard')?.id).toBe('overview');
  });

  it('resolves a detail route back to its parent item', () => {
    expect(itemForPath('/riders/usr_testrider01')?.id).toBe('riders');
  });

  it('resolves a sub-tab route to the owning item', () => {
    expect(itemForPath('/network/swap-stations')?.id).toBe('infrastructure');
    expect(itemForPath('/settings/pricing')?.id).toBe('settings');
  });

  it('does not match a path that merely shares a prefix string', () => {
    expect(itemForPath('/reportsomething')).toBeUndefined();
  });

  it('returns undefined for an unknown path', () => {
    expect(itemForPath('/nope')).toBeUndefined();
  });
});

describe('pathForScreen', () => {
  it('maps a permission key to its route', () => {
    expect(pathForScreen('infrastructure')).toBe('/network');
    expect(pathForScreen('employees')).toBe('/people');
  });

  it('falls back to the dashboard for an unknown key', () => {
    expect(pathForScreen('does-not-exist')).toBe('/dashboard');
  });

  it('round-trips every screen back to its own item', () => {
    for (const item of NAV_ITEMS) {
      expect(itemForPath(pathForScreen(item.id))?.id).toBe(item.id);
    }
  });
});
