import { actionLabel, formatBytes, formatPercent, formatUptime, statusLabel } from './format';

describe('format', () => {
  it('formate les octets', () => {
    expect(formatBytes(0)).toBe('0 o');
    expect(formatBytes(1024)).toBe('1.0 Ko');
    expect(formatBytes(1024 ** 3)).toBe('1.0 Go');
    expect(formatBytes(null)).toBe('—');
  });

  it('formate les durées', () => {
    expect(formatUptime(0)).toBe('—');
    expect(formatUptime(60)).toBe('1 min');
    expect(formatUptime(3660)).toBe('1 h 1 min');
    expect(formatUptime(90000)).toBe('1 j 1 h');
  });

  it('formate les pourcentages', () => {
    expect(formatPercent(12.34)).toBe('12.3 %');
    expect(formatPercent(null)).toBe('—');
  });

  it('traduit les libellés', () => {
    expect(actionLabel('start')).toBe('Démarrage');
    expect(statusLabel('running')).toBe('En marche');
    expect(statusLabel('inconnu')).toBe('inconnu');
  });
});
