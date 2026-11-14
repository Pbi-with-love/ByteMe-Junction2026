import { fireEvent,render,screen,waitFor } from '@testing-library/react';
import { describe,expect,it,vi } from 'vitest';
import level1 from '../../mocks/level1.json';
import { LevelMockSchema } from '../api/schemas';
import type { GatewayClient } from '../api/gateway';
import ApprovalCard from './ApprovalCard';

const mock=LevelMockSchema.parse(level1),recording=mock.presets.balanced!,step=recording.steps.find(item=>item.approval?.status==='OPEN')!,approval=step.approval!;
function renderCard(client:Partial<GatewayClient>={}){return render(<ApprovalCard client={client as GatewayClient} approval={approval} step={step} onSettled={vi.fn()}/>);}
describe('ApprovalCard',()=>{
 it('shows the gateway reason and discloses the late option before offering a decision',()=>{renderCard();expect(screen.getByRole('alertdialog')).toHaveAttribute('aria-modal','false');expect(screen.getByRole('heading',{name:approval.reasonText})).toBeInTheDocument();expect(screen.getByText('Recommended')).toBeInTheDocument();expect(screen.getByText(/Late delivery/)).toBeInTheDocument();expect(screen.getByText(/arrives .* after the deadline/)).toBeInTheDocument();});
 it('sends one approved decision and renders the returned order state',async()=>{const settled=recording.decisions![approval.approvalId]!.approved.body as never;const decide=vi.fn(async()=>settled);renderCard({decideApproval:decide});const approve=screen.getByRole('button',{name:'Approve'});fireEvent.click(approve);fireEvent.click(approve);await waitFor(()=>expect(decide).toHaveBeenCalledTimes(1));expect(await screen.findByRole('status')).toHaveTextContent('Approved · order CONFIRMED');});
});
