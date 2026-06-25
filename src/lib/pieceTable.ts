/**
 * HyperDrive Piece Table Text Buffer
 * Extremely optimized data structure to handle large text files (up to 50,000+ lines)
 * without blocking the SolidJS UI thread.
 */

export interface Piece {
  bufferType: "original" | "add";
  start: number;
  length: number;
  lineFeedCount: number;
}

export class PieceTable {
  private originalBuffer: string;
  private addBuffer: string;
  private pieces: Piece[];

  constructor(initialText: string = "") {
    this.originalBuffer = initialText;
    this.addBuffer = "";
    
    // Count line feeds in initial text
    const lfCount = this.countLineFeeds(initialText);
    
    this.pieces = initialText.length > 0 ? [
      {
        bufferType: "original",
        start: 0,
        length: initialText.length,
        lineFeedCount: lfCount
      }
    ] : [];
  }

  private countLineFeeds(str: string): number {
    let count = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "\n") count++;
    }
    return count;
  }

  /**
   * Helper to count line feeds in a substring of original or add buffers
   */
  private countLineFeedsRange(bufferType: "original" | "add", start: number, length: number): number {
    const buf = bufferType === "original" ? this.originalBuffer : this.addBuffer;
    let count = 0;
    const end = start + length;
    for (let i = start; i < end; i++) {
      if (buf[i] === "\n") count++;
    }
    return count;
  }

  /**
   * Resolve an absolute character offset to the matching piece index and offset inside the piece.
   */
  private resolveOffset(offset: number): { pieceIdx: number; pieceOffset: number } {
    let currentOffset = 0;
    for (let i = 0; i < this.pieces.length; i++) {
      const piece = this.pieces[i]!;
      if (offset >= currentOffset && offset <= currentOffset + piece.length) {
        return { pieceIdx: i, pieceOffset: offset - currentOffset };
      }
      currentOffset += piece.length;
    }
    // Fallback to the last piece or return empty resolution
    return { pieceIdx: this.pieces.length - 1, pieceOffset: this.pieces[this.pieces.length - 1]?.length ?? 0 };
  }

  public get length(): number {
    let len = 0;
    for (let i = 0; i < this.pieces.length; i++) {
      len += this.pieces[i]!.length;
    }
    return len;
  }

  /**
   * Inserts text at absolute offset
   */
  public insert(offset: number, text: string): void {
    if (text.length === 0) return;

    // Append to add buffer
    const addBufferStart = this.addBuffer.length;
    this.addBuffer += text;
    const lfCount = this.countLineFeeds(text);

    const newPiece: Piece = {
      bufferType: "add",
      start: addBufferStart,
      length: text.length,
      lineFeedCount: lfCount
    };

    if (this.pieces.length === 0) {
      this.pieces.push(newPiece);
      return;
    }

    const { pieceIdx, pieceOffset } = this.resolveOffset(offset);
    const targetPiece = this.pieces[pieceIdx]!;

    // Case 1: Insert at boundary start
    if (pieceOffset === 0) {
      this.pieces.splice(pieceIdx, 0, newPiece);
    }
    // Case 2: Insert at boundary end
    else if (pieceOffset === targetPiece.length) {
      this.pieces.splice(pieceIdx + 1, 0, newPiece);
    }
    // Case 3: Split target piece in two parts
    else {
      const leftLength = pieceOffset;
      const rightLength = targetPiece.length - pieceOffset;

      const leftPiece: Piece = {
        bufferType: targetPiece.bufferType,
        start: targetPiece.start,
        length: leftLength,
        lineFeedCount: this.countLineFeedsRange(targetPiece.bufferType, targetPiece.start, leftLength)
      };

      const rightPiece: Piece = {
        bufferType: targetPiece.bufferType,
        start: targetPiece.start + pieceOffset,
        length: rightLength,
        lineFeedCount: this.countLineFeedsRange(targetPiece.bufferType, targetPiece.start + pieceOffset, rightLength)
      };

      this.pieces.splice(pieceIdx, 1, leftPiece, newPiece, rightPiece);
    }
  }

  /**
   * Deletes characters at absolute offset
   */
  public delete(offset: number, length: number): void {
    if (length <= 0 || this.pieces.length === 0) return;

    const startResolution = this.resolveOffset(offset);
    const endResolution = this.resolveOffset(offset + length);

    const startPieceIdx = startResolution.pieceIdx;
    const startPieceOffset = startResolution.pieceOffset;
    const endPieceIdx = endResolution.pieceIdx;
    const endPieceOffset = endResolution.pieceOffset;

    if (startPieceIdx === endPieceIdx) {
      const targetPiece = this.pieces[startPieceIdx]!;
      // Case 1: Delete whole piece
      if (startPieceOffset === 0 && endPieceOffset === targetPiece.length) {
        this.pieces.splice(startPieceIdx, 1);
      }
      // Case 2: Delete from start of piece
      else if (startPieceOffset === 0) {
        targetPiece.start += endPieceOffset;
        targetPiece.length -= endPieceOffset;
        targetPiece.lineFeedCount = this.countLineFeedsRange(targetPiece.bufferType, targetPiece.start, targetPiece.length);
      }
      // Case 3: Delete from end of piece
      else if (endPieceOffset === targetPiece.length) {
        targetPiece.length = startPieceOffset;
        targetPiece.lineFeedCount = this.countLineFeedsRange(targetPiece.bufferType, targetPiece.start, targetPiece.length);
      }
      // Case 4: Split piece
      else {
        const leftLength = startPieceOffset;
        const rightLength = targetPiece.length - endPieceOffset;

        const leftPiece: Piece = {
          bufferType: targetPiece.bufferType,
          start: targetPiece.start,
          length: leftLength,
          lineFeedCount: this.countLineFeedsRange(targetPiece.bufferType, targetPiece.start, leftLength)
        };

        const rightPiece: Piece = {
          bufferType: targetPiece.bufferType,
          start: targetPiece.start + endPieceOffset,
          length: rightLength,
          lineFeedCount: this.countLineFeedsRange(targetPiece.bufferType, targetPiece.start + endPieceOffset, rightLength)
        };

        this.pieces.splice(startPieceIdx, 1, leftPiece, rightPiece);
      }
    } else {
      // Deletion spans multiple pieces
      const leftPiece = this.pieces[startPieceIdx]!;
      const rightPiece = this.pieces[endPieceIdx]!;

      // Shrink boundary pieces
      if (startPieceOffset > 0) {
        leftPiece.length = startPieceOffset;
        leftPiece.lineFeedCount = this.countLineFeedsRange(leftPiece.bufferType, leftPiece.start, leftPiece.length);
      }
      
      if (endPieceOffset < rightPiece.length) {
        rightPiece.start += endPieceOffset;
        rightPiece.length -= endPieceOffset;
        rightPiece.lineFeedCount = this.countLineFeedsRange(rightPiece.bufferType, rightPiece.start, rightPiece.length);
      }

      // Remove intermediate pieces entirely
      const spliceStart = startPieceOffset > 0 ? startPieceIdx + 1 : startPieceIdx;
      const spliceEnd = endPieceOffset < rightPiece.length ? endPieceIdx : endPieceIdx + 1;
      this.pieces.splice(spliceStart, spliceEnd - spliceStart);
    }
  }

  /**
   * Retrieves full string content from the piece table
   */
  public getVal(): string {
    let result = "";
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i]!;
      const buf = p.bufferType === "original" ? this.originalBuffer : this.addBuffer;
      result += buf.substring(p.start, p.start + p.length);
    }
    return result;
  }

  /**
   * Returns line index matching character offset
   */
  public getLineAndColumn(offset: number): { line: number; column: number } {
    let currentOffset = 0;
    let line = 1;
    let lastLfOffset = 0;

    for (let i = 0; i < this.pieces.length; i++) {
      const piece = this.pieces[i]!;
      const buf = piece.bufferType === "original" ? this.originalBuffer : this.addBuffer;
      
      if (offset >= currentOffset && offset <= currentOffset + piece.length) {
        // Target offset lies in this piece
        const innerOffset = offset - currentOffset;
        for (let j = 0; j < innerOffset; j++) {
          if (buf[piece.start + j] === "\n") {
            line++;
            lastLfOffset = currentOffset + j + 1;
          }
        }
        return { line, column: offset - lastLfOffset + 1 };
      }

      // Count LFs in this piece if not resolved yet
      if (piece.lineFeedCount > 0) {
        for (let j = 0; j < piece.length; j++) {
          if (buf[piece.start + j] === "\n") {
            line++;
            lastLfOffset = currentOffset + j + 1;
          }
        }
      }
      currentOffset += piece.length;
    }

    return { line, column: offset - lastLfOffset + 1 };
  }
}
