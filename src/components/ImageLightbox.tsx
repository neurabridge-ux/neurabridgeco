import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ImageLightbox = ({ src, alt = "", open, onOpenChange }: ImageLightboxProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none [&>button]:text-white [&>button]:bg-black/50 [&>button]:rounded-full [&>button]:p-1">
      <img
        src={src}
        alt={alt}
        className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
      />
    </DialogContent>
  </Dialog>
);

export default ImageLightbox;
