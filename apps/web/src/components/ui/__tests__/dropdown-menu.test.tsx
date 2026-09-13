import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../dropdown-menu';

/**
 * Helper to render an open dropdown by clicking the trigger.
 * Radix portals content only when open.
 */
async function renderOpenMenu(ui: React.ReactElement) {
  const user = userEvent.setup();
  render(ui);
  await user.click(screen.getByText('Open'));
}

describe('DropdownMenu components', () => {
  it('renders trigger and opens menu on click', async () => {
    await renderOpenMenu(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('renders DropdownMenuItem with inset prop', async () => {
    await renderOpenMenu(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem inset>Inset Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    expect(screen.getByText('Inset Item')).toBeInTheDocument();
  });

  it('renders DropdownMenuLabel with inset prop', async () => {
    await renderOpenMenu(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel inset>My Label</DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    expect(screen.getByText('My Label')).toBeInTheDocument();
  });

  it('renders DropdownMenuSeparator', async () => {
    await renderOpenMenu(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>A</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>B</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    // Radix renders separator with role="separator"
    const separator = screen.getByRole('separator');
    expect(separator).toBeInTheDocument();
  });

  it('renders DropdownMenuCheckboxItem with checked and unchecked', async () => {
    await renderOpenMenu(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuCheckboxItem checked onCheckedChange={vi.fn()}>
              Checked Item
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem onCheckedChange={vi.fn()}>
              Unchecked Item
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    expect(screen.getByText('Checked Item')).toBeInTheDocument();
    expect(screen.getByText('Unchecked Item')).toBeInTheDocument();
  });

  it('renders DropdownMenuRadioItem', async () => {
    await renderOpenMenu(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="a" onValueChange={vi.fn()}>
            <DropdownMenuRadioItem value="a">Radio A</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="b">Radio B</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    expect(screen.getByText('Radio A')).toBeInTheDocument();
    expect(screen.getByText('Radio B')).toBeInTheDocument();
  });

  it('renders DropdownMenuSubTrigger with inset', async () => {
    await renderOpenMenu(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger inset>Sub Menu</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub Item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    expect(screen.getByText('Sub Menu')).toBeInTheDocument();
  });

  it('renders DropdownMenuSubTrigger without inset', async () => {
    await renderOpenMenu(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Sub Menu</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub Item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    expect(screen.getByText('Sub Menu')).toBeInTheDocument();
  });

  it('renders DropdownMenuShortcut inside menu item', async () => {
    await renderOpenMenu(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            Save
            <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    expect(screen.getByText('Ctrl+S')).toBeInTheDocument();
  });
});
