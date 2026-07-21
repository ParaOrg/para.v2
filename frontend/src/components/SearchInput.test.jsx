import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SearchInput from './SearchInput';

describe('SearchInput', () => {
  beforeEach(() => {
    // No window.google in jsdom -- component should degrade gracefully
    // (no autocomplete predictions) rather than throwing.
    delete window.google;
  });

  afterEach(() => {
    delete window.google;
  });

  it('renders with the expected placeholder', () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Where do you want to go?')).toBeInTheDocument();
  });

  it('reflects the controlled value prop', () => {
    render(<SearchInput value="Cubao" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('Cubao')).toBeInTheDocument();
  });

  it('calls onChange when the user types', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);

    await user.type(screen.getByPlaceholderText('Where do you want to go?'), 'A');

    expect(onChange).toHaveBeenCalled();
  });

  it('calls onFocus when the input is focused', async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    render(<SearchInput value="" onChange={vi.fn()} onFocus={onFocus} />);

    await user.click(screen.getByPlaceholderText('Where do you want to go?'));

    expect(onFocus).toHaveBeenCalled();
  });

  it('does not render a predictions dropdown without a Google Maps API', () => {
    render(<SearchInput value="Cubao" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /main_text/i })).not.toBeInTheDocument();
  });
});
