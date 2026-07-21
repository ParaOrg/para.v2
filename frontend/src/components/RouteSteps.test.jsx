import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RouteSteps from './RouteSteps';

const markers = [{ name: 'Cubao' }, { name: 'Ayala' }];

const lines = [
  { type: 'Jeepney', name: 'Route A', color: '#ff0000', points: [[121.0, 14.6]] },
  { type: 'Jeepney', name: 'Route A', color: '#ff0000', points: [[121.001, 14.6]] },
  { type: 'Walk', name: 'Walking Path', color: '#00ff00', points: [[121.002, 14.6]] },
  { type: 'Bus', name: 'Route B', color: '#0000ff', points: [[121.003, 14.6]] },
];

describe('RouteSteps', () => {
  it('renders nothing when there are no lines', () => {
    const { container } = render(<RouteSteps markers={markers} lines={[]} onBack={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when lines is undefined', () => {
    const { container } = render(<RouteSteps markers={markers} lines={undefined} onBack={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('groups consecutive same-type lines into a single step', () => {
    render(<RouteSteps markers={markers} lines={lines} onBack={vi.fn()} />);

    // 3 groups: Jeepney (merged), Walk, Bus -- so exactly one "Jeepney" step label.
    expect(screen.getAllByText('Jeepney')).toHaveLength(1);
    expect(screen.getAllByText('Walk')).toHaveLength(1);
    expect(screen.getAllByText('Bus')).toHaveLength(1);
  });

  it('shows the destination name from the last marker', () => {
    render(<RouteSteps markers={markers} lines={lines} onBack={vi.fn()} />);
    expect(screen.getByText('Ayala')).toBeInTheDocument();
  });

  it('computes and displays the total fare across all steps', () => {
    // Jeepney (15) + Walk (0) + Bus (20) = 35
    const { container } = render(<RouteSteps markers={markers} lines={lines} onBack={vi.fn()} />);
    expect(container.textContent).toContain('₱35');
  });
});
