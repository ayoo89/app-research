import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

const MAX_TEXT_LENGTH   = 500;
const MAX_BASE64_BYTES  = 5 * 1024 * 1024; // 5 MB decoded
const ALLOWED_IMG_MAGIC = [
  'iVBORw0KGgo',  // PNG
  '/9j/',          // JPEG
  'R0lGOD',        // GIF
  'UklGR',         // WebP
];

@Injectable()
export class SearchInputPipe implements PipeTransform {
  transform(value: any) {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('Invalid request body');
    }

    // Text validation
    if (value.text !== undefined) {
      if (typeof value.text !== 'string') throw new BadRequestException('text must be a string');
      value.text = value.text.trim().slice(0, MAX_TEXT_LENGTH);
      if (!value.text) delete value.text;
    }

    // Barcode validation
    if (value.barcode !== undefined) {
      if (typeof value.barcode !== 'string') throw new BadRequestException('barcode must be a string');
      value.barcode = value.barcode.trim().replace(/[^a-zA-Z0-9\-_.]/g, '');
      if (!value.barcode) delete value.barcode;
    }

    // Image validation
    if (value.imageBase64 !== undefined) {
      if (typeof value.imageBase64 !== 'string') {
        throw new BadRequestException('imageBase64 must be a string');
      }
      // Strip data URI prefix if present
      const b64 = value.imageBase64.replace(/^data:image\/\w+;base64,/, '');

      // Size check (base64 is ~4/3 of binary)
      if (b64.length * 0.75 > MAX_BASE64_BYTES) {
        throw new BadRequestException('Image too large (max 5MB)');
      }

      // Magic bytes check — ensure it's actually an image
      const isImage = ALLOWED_IMG_MAGIC.some((magic) => b64.startsWith(magic));
      if (!isImage) {
        throw new BadRequestException('Invalid image format. Supported: JPEG, PNG, WebP, GIF');
      }

      value.imageBase64 = b64;
    }

    // Guard: at least one valid search field must remain after sanitisation
    if (!value.barcode && !value.text && !value.imageBase64) {
      throw new BadRequestException('Provide at least one of: barcode, text, imageBase64');
    }

    return value;
  }
}
