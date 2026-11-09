
import React from 'react';
import {
  Dna,
  Microscope,
  FlaskConical,
  Atom,
  Calculator,
  Laptop,
  Code,
  Cpu,
  Cog,
  Building2,
  BookOpen,
  Zap,
  Radio,
  FileSpreadsheet,
  Globe,
  Briefcase
} from 'lucide-react';

/**
 * Reusable subject icon mapping utility.
 * Inspects courseCode and courseName (or category) to select an appropriate
 * icon component and theme styling (background, text, and border classes).
 */
export function getCourseSubjectTheme(courseCode = '', courseName = '') {
  const code = (courseCode || '').toUpperCase().trim();
  const name = (courseName || '').toLowerCase().trim();
  const combined = `${code} ${name}`;

  // 1. Biology & Life Sciences (BIO, BME, BIOT, etc.)
  if (code.startsWith('BIO') || combined.includes('bio') || combined.includes('cell') || combined.includes('tissue') || combined.includes('genetic')) {
    // Distinguish between physiology/cells vs genetics vs bio-chemistry
    if (combined.includes('cell') || combined.includes('physio') || combined.includes('tissue') || code.includes('1101')) {
      return {
        icon: Microscope,
        bgClass: 'bg-[#F3E8FF]',
        textClass: 'text-[#9333EA]',
        borderClass: 'border-[#E9D5FF]',
        badgeBg: 'bg-[#FAF5FF]',
        label: 'Biology / Physiology'
      };
    }
    if (combined.includes('chem') || combined.includes('lab') || code.endsWith('2') || code.endsWith('4')) {
      return {
        icon: FlaskConical,
        bgClass: 'bg-[#FFE4E6]',
        textClass: 'text-[#E11D48]',
        borderClass: 'border-[#FECDD3]',
        badgeBg: 'bg-[#FFF1F2]',
        label: 'Bio-Sciences'
      };
    }
    return {
      icon: Dna,
      bgClass: 'bg-[#FEF3C7]',
      textClass: 'text-[#D97706]',
      borderClass: 'border-[#FDE68A]',
      badgeBg: 'bg-[#FFFBEB]',
      label: 'Bioengineering'
    };
  }

  // 2. Chemistry (CHM, CHE, CHEMICAL)
  if (code.startsWith('CHM') || code.startsWith('CHE') || combined.includes('chem')) {
    return {
      icon: FlaskConical,
      bgClass: 'bg-[#FCE7F3]',
      textClass: 'text-[#DB2777]',
      borderClass: 'border-[#FBCFE8]',
      badgeBg: 'bg-[#FDF2F8]',
      label: 'Chemistry'
    };
  }

  // 3. Physics (PHY)
  if (code.startsWith('PHY') || combined.includes('physic') || combined.includes('quantum') || combined.includes('optics')) {
    return {
      icon: Atom,
      bgClass: 'bg-[#EDE9FE]',
      textClass: 'text-[#7C3AED]',
      borderClass: 'border-[#DDD6FE]',
      badgeBg: 'bg-[#F5F3FF]',
      label: 'Physics'
    };
  }

  // 4. Mathematics & Statistics (MAT, MTH, STAT)
  if (
    code.startsWith('MAT') ||
    code.startsWith('MTH') ||
    code.startsWith('STA') ||
    combined.includes('math') ||
    combined.includes('calculus') ||
    combined.includes('algebra') ||
    combined.includes('statistic')
  ) {
    return {
      icon: Calculator,
      bgClass: 'bg-[#FEF9C3]',
      textClass: 'text-[#CA8A04]',
      borderClass: 'border-[#FEF08A]',
      badgeBg: 'bg-[#FEFCE8]',
      label: 'Mathematics'
    };
  }

  // 5. Computer Science, IT, Software (CSE, SWE, ITE, CST, DSA, etc.)
  if (
    code.startsWith('CSE') ||
    code.startsWith('SWE') ||
    code.startsWith('ITE') ||
    code.startsWith('CST') ||
    code.startsWith('INT') ||
    combined.includes('computer') ||
    combined.includes('software') ||
    combined.includes('data struct') ||
    combined.includes('algorithm') ||
    combined.includes('programming') ||
    combined.includes('web') ||
    combined.includes('network')
  ) {
    return {
      icon: Laptop,
      bgClass: 'bg-[#E0F2FE]',
      textClass: 'text-[#0284C7]',
      borderClass: 'border-[#BAE6FD]',
      badgeBg: 'bg-[#F0F9FF]',
      label: 'Computer Science'
    };
  }

  // 6. Electronics, Electrical, Circuits (ECE, EEE, ECM)
  if (
    code.startsWith('ECE') ||
    code.startsWith('EEE') ||
    code.startsWith('ECM') ||
    combined.includes('electron') ||
    combined.includes('circuit') ||
    combined.includes('signal') ||
    combined.includes('telecom')
  ) {
    return {
      icon: Cpu,
      bgClass: 'bg-[#DCFCE7]',
      textClass: 'text-[#16A34A]',
      borderClass: 'border-[#BBF7D0]',
      badgeBg: 'bg-[#F0FDF4]',
      label: 'Electronics'
    };
  }

  // 7. Mechanical & Automobile (MEC, MECH, AUE)
  if (
    code.startsWith('MEC') ||
    code.startsWith('AUE') ||
    combined.includes('mechanic') ||
    combined.includes('thermo') ||
    combined.includes('fluid') ||
    combined.includes('machine')
  ) {
    return {
      icon: Cog,
      bgClass: 'bg-[#FFEDD5]',
      textClass: 'text-[#EA580C]',
      borderClass: 'border-[#FED7AA]',
      badgeBg: 'bg-[#FFF7ED]',
      label: 'Mechanical'
    };
  }

  // 8. Civil & Construction (CIV, CLE)
  if (
    code.startsWith('CIV') ||
    code.startsWith('CLE') ||
    combined.includes('civil') ||
    combined.includes('structur') ||
    combined.includes('construct')
  ) {
    return {
      icon: Building2,
      bgClass: 'bg-[#FEF3C7]',
      textClass: 'text-[#B45309]',
      borderClass: 'border-[#FDE68A]',
      badgeBg: 'bg-[#FFFBEB]',
      label: 'Civil'
    };
  }

  // 9. Humanities, Management, Languages (ENG, HUM, MGT, FRE, GER)
  if (
    code.startsWith('ENG') ||
    code.startsWith('HUM') ||
    code.startsWith('MGT') ||
    code.startsWith('FRE') ||
    code.startsWith('GER') ||
    combined.includes('manage') ||
    combined.includes('english')
  ) {
    return {
      icon: Globe,
      bgClass: 'bg-[#F1F5F9]',
      textClass: 'text-[#475569]',
      borderClass: 'border-[#E2E8F0]',
      badgeBg: 'bg-[#F8FAFC]',
      label: 'Humanities & Management'
    };
  }

  // 10. Default / Fallback Category
  return {
    icon: BookOpen,
    bgClass: 'bg-[#FEF3C7]',
    textClass: 'text-[#D97706]',
    borderClass: 'border-[#FEF08A]',
    badgeBg: 'bg-[#FFFBEB]',
    label: 'Course'
  };
}

/**
 * Subject Icon Component helper
 */
export function CourseSubjectIcon({ courseCode, courseName, className = 'w-6 h-6 stroke-[2]' }) {
  const theme = getCourseSubjectTheme(courseCode, courseName);
  const IconComponent = theme.icon;
  return <IconComponent className={`${className} ${theme.textClass}`} />;
}
