import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { MovementDetails } from '../../core/models/finance.models';
import { CategoryIconComponent } from '../category-icon/category-icon';

@Component({
  selector: 'app-movement-detail-modal',
  imports: [CommonModule, CategoryIconComponent],
  templateUrl: './movement-detail-modal.html',
  styleUrl: './movement-detail-modal.scss',
})
export class MovementDetailModalComponent {
  @Input({ required: true }) movement!: MovementDetails;
  @Output() readonly closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    this.closed.emit();
  }
}
