import { Component, Input } from '@angular/core';
import {
  CarFront,
  CircleDollarSign,
  House,
  HousePlug,
  Landmark,
  LucideAngularModule,
  LucideIconData,
  Megaphone,
  PackageOpen,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Toolbox,
  TrendingUp,
  Users,
} from 'lucide-angular';

interface CategoryVisual {
  icon: LucideIconData;
  color: string;
  background: string;
}

const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  sales: { icon: ShoppingBag, color: '#15803d', background: '#dcfce7' },
  services: { icon: Toolbox, color: '#1d4ed8', background: '#dbeafe' },
  refund: { icon: RotateCcw, color: '#0f766e', background: '#ccfbf1' },
  investment: { icon: TrendingUp, color: '#7e22ce', background: '#f3e8ff' },
  supplies: { icon: PackageOpen, color: '#b45309', background: '#fef3c7' },
  rent: { icon: House, color: '#c2410c', background: '#ffedd5' },
  utilities: { icon: HousePlug, color: '#a16207', background: '#fef9c3' },
  transportation: { icon: CarFront, color: '#4338ca', background: '#e0e7ff' },
  taxes: { icon: ReceiptText, color: '#b91c1c', background: '#fee2e2' },
  marketing: { icon: Megaphone, color: '#be185d', background: '#fce7f3' },
  salaries: { icon: Users, color: '#6d28d9', background: '#ede9fe' },
  bank_fees: { icon: Landmark, color: '#475569', background: '#e2e8f0' },
  other: { icon: CircleDollarSign, color: '#4b5563', background: '#f3f4f6' },
};

@Component({
  selector: 'app-category-icon',
  imports: [LucideAngularModule],
  template: `
    <span
      class="category-icon"
      [class.category-icon--background]="withBackground"
      [style.width.px]="containerSize"
      [style.height.px]="containerSize"
      [style.color]="visual.color"
      [style.background]="withBackground ? visual.background : 'transparent'"
      aria-hidden="true"
    >
      <lucide-icon [img]="visual.icon" [size]="size" [strokeWidth]="2" />
    </span>
  `,
  styles: `
    .category-icon {
      display: inline-grid;
      flex: 0 0 auto;
      place-items: center;
    }

    .category-icon--background {
      border-radius: 14px;
    }
  `,
})
export class CategoryIconComponent {
  @Input() category = 'other';
  @Input() size = 20;
  @Input() withBackground = false;

  protected get visual(): CategoryVisual {
    return CATEGORY_VISUALS[this.category] ?? CATEGORY_VISUALS['other'];
  }

  protected get containerSize(): number {
    return this.withBackground ? this.size + 22 : this.size;
  }
}
