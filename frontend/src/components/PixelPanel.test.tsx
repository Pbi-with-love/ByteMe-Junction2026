import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PixelPanel from './PixelPanel';
describe('PixelPanel',()=>{it('focuses the title, handles Escape and preserves hidden content',()=>{const close=vi.fn();const {rerender}=render(<PixelPanel variant="clipboard" title="Brief" onClose={close}><input aria-label="saved" defaultValue="yes"/></PixelPanel>); expect(screen.getByRole('heading',{name:'Brief'})).toHaveFocus(); fireEvent.keyDown(document,{key:'Escape'});expect(close).toHaveBeenCalledOnce();rerender(<PixelPanel variant="clipboard" title="Brief" hidden onClose={close}><input aria-label="saved" defaultValue="yes"/></PixelPanel>);expect(screen.getByLabelText('saved')).toBeInTheDocument();expect(screen.getByRole('dialog',{hidden:true})).toHaveAttribute('hidden');});});

describe('PixelPanel alert',()=>{it('uses alert semantics and focuses its heading',()=>{render(<PixelPanel variant="alert" title="World failed">Try again</PixelPanel>);expect(screen.getByRole('alert')).toBeInTheDocument();expect(screen.getByRole('heading',{name:'World failed'})).toHaveFocus();expect(screen.getByRole('alert')).not.toHaveAttribute('aria-modal');});});

describe('PixelPanel incident',()=>{it('uses dialog semantics and focuses its heading',()=>{render(<PixelPanel variant="incident" title="Safety incident">Details</PixelPanel>);expect(screen.getByRole('dialog')).toHaveClass('pixel-panel-incident');expect(screen.getByRole('heading',{name:'Safety incident'})).toHaveFocus();});});
