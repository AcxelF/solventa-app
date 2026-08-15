import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";

export default function ConfirmDialog({
  title,
  message,
  confirmText = "Eliminar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-text-secondary">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="subtle" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button variant="dangerSolid" onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
