import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogClose, 
  DialogFooter 
} from "@/components/ui/dialog"
import { PaymentStreamSummary } from "./PaymentStreamSummary"
import { PaymentStreamFormData } from "@/lib/validations"
import { Loader2 } from "lucide-react"

interface PaymentStreamConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: PaymentStreamFormData
  onConfirm: (data: PaymentStreamFormData) => Promise<void>
  isSubmitting: boolean
}

export function PaymentStreamConfirmationModal({
  open,
  onOpenChange,
  data,
  onConfirm,
  isSubmitting,
}: PaymentStreamConfirmationModalProps) {
  const handleConfirm = () => {
    if (isSubmitting) {
      return
    }
    onConfirm(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirm Payment Stream</DialogTitle>
          <DialogClose onClick={() => onOpenChange(false)} />
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-zinc-400">
            Please review the payment stream details before confirming the transaction.
          </p>
          
          <PaymentStreamSummary data={data} />
          
          <div className="p-4 bg-yellow-900/20 border border-yellow-800 rounded-lg">
            <h4 className="font-medium text-yellow-400 mb-2">Important Notes:</h4>
            <ul className="text-sm text-yellow-300 space-y-1">
              <li>• This transaction will be submitted to the Stellar network</li>
              <li>• The total amount will be locked in the smart contract</li>
              <li>• The recipient can withdraw tokens as they vest over time</li>
              {data.cancelable && (
                <li>• You can cancel this stream at any time and recover remaining funds</li>
              )}
              {!data.cancelable && (
                <li>• This stream cannot be canceled once created</li>
              )}
            </ul>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={isSubmitting ? "pointer-events-none" : ""}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Stream...
              </>
            ) : "Confirm & Create Stream"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}