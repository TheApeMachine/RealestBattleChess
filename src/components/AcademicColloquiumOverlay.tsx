import React from 'react';
import {
  AcademicColloquiumState,
  AcademicEmailItem,
  ChessPiece,
  PieceType,
} from '../types/game';
import { formatSquareName } from '../engine/chessEngine';
import {
  BookOpen,
  CheckCircle2,
  Coffee,
  DollarSign,
  FileText,
  FlaskConical,
  GraduationCap,
  Home,
  Mail,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Award,
  ArrowRight,
} from 'lucide-react';

export interface ProfessorPersona {
  academicTitle: string;
  department: string;
  elbowPatchStyle: string;
  hIndex: number;
  monograph: string;
}

export function getProfessorPersona(piece: ChessPiece): ProfessorPersona {
  const isSolaris = piece.faction === 'w';
  const map: Record<PieceType, ProfessorPersona> = {
    p: {
      academicTitle: 'Dr. Pawn (Untenured Assistant Professor)',
      department: 'Dept. of Retrocausal & Constructive Mathematics, Univ. of Greater Andromeda',
      elbowPatchStyle: 'Threadbare Cognac Suede Elbow Patches',
      hIndex: 4,
      monograph: 'On the Nonexistence of Monarchs in Retrocausal Systems (Unpublished)',
    },
    n: {
      academicTitle: isSolaris
        ? 'Toby (7th-Year ABD Graduate Student)'
        : 'Assoc. Prof. Knight (Rival Sirius-B Group)',
      department: 'Sub-Basement Cubicle 02, Peano Hall',
      elbowPatchStyle: 'Coffee-Stained Corduroy Patches',
      hIndex: 2,
      monograph: 'Sign Errors in the Retrocausal Jacobian (Thesis Draft, Year 7)',
    },
    b: {
      academicTitle: 'Prof. Bishop (Director of the Quantum Laboratory)',
      department: 'Center for Chiral Interferometry & Restricted Equipment',
      elbowPatchStyle: 'Velvet-Trimmed Oxford Elbow Patches',
      hIndex: 31,
      monograph: 'Why My Lab Is Booked Through 2029 (Internal Memo)',
    },
    r: {
      academicTitle: 'Prof. Rook (Newly Tenured Full Professor · Reviewer #2)',
      department: 'Chair of Rectilinear Repetition & Self-Citation',
      elbowPatchStyle: 'Oxblood Saddle-Leather Elbow Patches',
      hIndex: 64,
      monograph:
        'On Rectilinear Files (1997a), Rectilinear Files Revisited (1997b), & Files: A Rectilinear View (1997c)',
    },
    q: {
      academicTitle: 'Dr. Queen (Department Chairwoman)',
      department: 'Office of Faculty Productivity & Indirect Grant Overhead',
      elbowPatchStyle: 'Tailored Charcoal Herringbone Tweed',
      hIndex: 52,
      monograph: 'Quantifying Departmental Synergy in 14 Quarterly Metrics',
    },
    k: {
      academicTitle: 'Provost King (Vice-Chancellor of Budget Freezes)',
      department: 'Central Administration Tower, University of Greater Andromeda',
      elbowPatchStyle: 'Ermine-Lined Administrative Blazer',
      hIndex: 7,
      monograph: 'Why the 1987 Coffee Machine Is Not in This Fiscal Year’s Capital Budget',
    },
  };
  return map[piece.type];
}

export function createInitialAcademicColloquiumState(
  candidatePiece: ChessPiece,
  allPieces: ChessPiece[],
  coAuthorTimelineCode: string
): AcademicColloquiumState {
  const friendlyFaculty = allPieces
    .filter(
      (p) =>
        p.faction === candidatePiece.faction &&
        p.id !== candidatePiece.id &&
        (p.type === 'q' || p.type === 'r' || p.type === 'b' || p.type === 'n')
    )
    .slice(0, 3);

  const enemyKnight = allPieces.find((p) => p.faction !== candidatePiece.faction && p.type === 'n');
  const enemyRook = allPieces.find((p) => p.faction !== candidatePiece.faction && p.type === 'r');
  const enemyBishop = allPieces.find((p) => p.faction !== candidatePiece.faction && p.type === 'b');

  const initialInbox: AcademicEmailItem[] = [
    {
      id: 'email_grad_lemma',
      sender: 'Toby (Your Graduate Student)',
      senderRole: '7th-Year PhD Candidate · Office 4B-Annex',
      subject: 'URGENT: Central Lemma (Lemma 3.2) might be wrong...',
      dateLabel: 'Year 1 · Fall (Nov 14, 11:42 PM)',
      category: 'GRAD_STUDENT',
      unread: true,
      body: `Dr. Pawn,\n\nI'm sorry to email you this late while it's pouring rain outside, but I was checking the boundary conditions for "On the Nonexistence of Monarchs in Retrocausal Systems."\n\nThere is a sign error in the retrocausal Jacobian in Lemma 3.2. As written, the operator doesn't annihilate the Monarch at t₀ − 1 — it diverges. We need access to Prof. Bishop's Quantum Laboratory to run the numerical verification, or Reviewer #2 will tear us to pieces.\n\nAlso, the 1987 coffee machine in the breakroom made a loud clunk and died again.\n\n— Toby`,
    },
    {
      id: 'email_chair_queen',
      sender: 'Dr. Queen (Department Chair)',
      senderRole: 'Chair, Dept. of Retrocausal Mathematics',
      subject: 'Tenure-Track Annual Review & 8:00 AM Service Teaching',
      dateLabel: 'Year 1 · Fall (Nov 12, 8:04 AM)',
      category: 'CHAIR',
      unread: true,
      body: `Dr. Pawn,\n\nAs you know, your tenure clock at the University of Greater Andromeda is ticking. While your "controversial" manuscript on retrocausal monarchs is... ambitious, the Dean's Office measures faculty output strictly via h-index, external grant overhead (58.5% indirect rate), and published articles in the Journal of Transfinite Causality.\n\nBy the way, I have assigned you to teach MATH 101 (380 freshmen, 8:00 AM Mondays) next semester. Please do not ask me about replacing the 1987 coffee machine.\n\nRegards,\nChairwoman Queen`,
    },
    {
      id: 'email_bishop_lab',
      sender: 'Prof. Bishop (Quantum Lab Director)',
      senderRole: 'Director, Chiral Interferometry Facility',
      subject: 'RE: RE: RE: Request for 2 Hours of Quantum Lab Time',
      dateLabel: 'Year 1 · Fall (Nov 10, 4:19 PM)',
      category: 'LAB_POLITICS',
      unread: false,
      body: `Dear Dr. Pawn,\n\nThank you for your fourteenth email requesting access to the Quantum Laboratory to test your "Central Lemma." Unfortunately, the Chiral Interferometer is currently booked 24/7 by my own research group for diagonal calibration.\n\nPerhaps if you had a higher h-index — like newly tenured Professor Rook — we could revisit this in Fiscal Year 2029.\n\nWarmly,\nProf. Bishop`,
    },
    {
      id: 'email_rook_tenure',
      sender: 'Office of the Provost',
      senderRole: 'University of Greater Andromeda Administration',
      subject: 'FACULTY SPOTLIGHT: Prof. Rook Awarded Full Tenure!',
      dateLabel: 'Year 1 · Fall (Nov 08, 9:00 AM)',
      category: 'ADMIN',
      unread: false,
      body: `Colleagues,\n\nPlease join the Administration in congratulating Professor Rook on his promotion to Full Professor with Permanent Tenure!\n\nThe Tenure Committee was deeply impressed by Prof. Rook's trilogy of landmark papers:\n1. "On Rectilinear Movement Along Open Files" (J. Transfinite Causality, 2021)\n2. "Open Files and Rectilinear Movement" (J. Transfinite Causality, 2023)\n3. "A Rectilinear Approach to Movement Along Open Files" (J. Transfinite Causality, 2025)\n\n(Note: Reception in Room 200. Bring your own mug; the 1987 coffee machine remains non-operational.)`,
    },
    {
      id: 'email_mortgage_1',
      sender: 'Andromeda Savings & Loan',
      senderRole: 'Residential Mortgage Servicing Division',
      subject: 'Monthly Mortgage Statement — $2,140.00 Due',
      dateLabel: 'Year 1 · Fall (Nov 01)',
      category: 'MORTGAGE',
      unread: false,
      body: `BORROWER: Dr. Pawn, Untenured Researcher\nPROPERTY: 412 Euclid Terrace (Unit B — Damp Basement)\nMONTHLY PAYMENT: $2,140.00\n\nNotice: On an assistant professor salary of $48,200/yr after university parking fees ($640/yr) and mandatory faculty senate dues, your checking account buffer is razor-thin. Do not miss a payment.`,
    },
  ];

  return {
    active: true,
    stage: 'WORLD_COLLAPSE_FADE',
    candidatePieceId: candidatePiece.id,
    candidateLineageId: candidatePiece.lineageId || candidatePiece.id,
    coAuthorTimelineCode,
    manuscriptTitle: 'On the Nonexistence of Monarchs in Retrocausal Systems',
    manuscriptVersion: 'UGA-Preprint-Yr1.tex',
    selectedAxiomMethodology: 'Retrocausal Operator Annihilation (Lemma 3.2)',
    rigorScore: 18,
    citationsCollected: 0,
    requiredCitations: 3,
    reviewer2CitationsBribed: false,
    latexOverfullHboxFixed: false,
    supplementalAppendixAttached: false,
    oralDefenseArgumentsWon: 0,
    oralDefenseDuelCompleted: false,
    facultyEndorserIds: friendlyFaculty.map((p) => p.id),
    endorsedByIds: [],
    reviewers: [
      {
        id: 'REVIEWER_1',
        label: 'Reviewer #1',
        professorTitle: 'Assoc. Prof. Knight',
        department: 'Sirius-B Competing Research Group',
        pieceType: 'n',
        pieceId: enemyKnight?.id,
        squareLabel: enemyKnight ? formatSquareName(enemyKnight) : 'B8',
        verdict: 'MINOR_REVISION',
        critiqueQuote:
          '“Interesting premise, though our competing group at Sirius-B is working on a similar bound.”',
        rebuttalResolved: false,
      },
      {
        id: 'REVIEWER_2',
        label: 'Reviewer #2',
        professorTitle: 'Tenured Prof. Rook',
        department: 'Journal of Transfinite Causality',
        pieceType: 'r',
        pieceId: enemyRook?.id,
        squareLabel: enemyRook ? formatSquareName(enemyRook) : 'A8',
        verdict: 'STRONG_REJECT',
        critiqueQuote:
          '“REJECT. The authors fail to cite Rook (2021, 2023, 2025), and Lemma 3.2 contains an obvious sign error.”',
        rebuttalResolved: false,
      },
      {
        id: 'REVIEWER_3',
        label: 'Reviewer #3',
        professorTitle: 'Prof. Bishop',
        department: 'Quantum Laboratory Committee',
        pieceType: 'b',
        pieceId: enemyBishop?.id,
        squareLabel: enemyBishop ? formatSquareName(enemyBishop) : 'C8',
        verdict: 'MAJOR_REVISION',
        critiqueQuote:
          '“Without experimental verification in a Chiral Quantum Laboratory, Lemma 3.2 is mere speculation.”',
        rebuttalResolved: false,
      },
    ],
    colloquiumLog: [
      '🌧️ Rain streaks against the window of Room 4B, Peano Hall. The 1987 coffee machine is still dead.',
      '📉 Your graduate student Toby just informed you that Central Lemma 3.2 may be incorrect.',
      '🏛️ The chess universe is gone. You are Dr. Pawn, an untenured researcher at the University of Greater Andromeda.',
    ],
    academicYear: 1,
    semester: 'Fall',
    annualSalary: 48200,
    checkingBalance: 2480,
    monthlyMortgage: 2140,
    mortgageMonthsBehind: 0,
    departmentalBudget: 4850,
    hIndex: 4,
    rookHIndex: 64,
    adminProductivityScore: 61.4,
    chairRelationship: 28,
    centralLemmaIntegrity: 18,
    bishopLabAccessGranted: false,
    bishopSuspectedWithholding: true,
    rookIdenticalPapersCount: 3,
    reviewer2RivalryLevel: 35,
    journalRejections: 0,
    equipmentSoldForFee: false,
    coffeeMachineKickCount: 0,
    selectedEmailId: 'email_grad_lemma',
    inbox: initialInbox,
  };
}

interface AcademicColloquiumOverlayProps {
  colloquium: AcademicColloquiumState;
  allPieces: ChessPiece[];
  selectedPiece: ChessPiece | null;
  onEnterUniversityOffice: () => void;
  onSelectEmail: (emailId: string) => void;
  onKickCoffeeMachine: () => void;
  onWorkOnCentralLemma: () => void;
  onConfrontBishopForLab: () => void;
  onApplyForGrantAndPayMortgage: () => void;
  onAttendConferenceAndDebateRook: () => void;
  onSubmitToJournalOfTransfiniteCausality: () => void;
  onFastForwardToYear6Desperation: () => void;
  onSellEquipmentForPerseusFee: () => void;
  onOpenAcceptanceLetter: () => void;
  onConcludePublicationAndRestorePieces: () => void;
}

export const AcademicColloquiumOverlay: React.FC<AcademicColloquiumOverlayProps> = ({
  colloquium,
  onEnterUniversityOffice,
  onSelectEmail,
  onKickCoffeeMachine,
  onWorkOnCentralLemma,
  onConfrontBishopForLab,
  onApplyForGrantAndPayMortgage,
  onAttendConferenceAndDebateRook,
  onSubmitToJournalOfTransfiniteCausality,
  onFastForwardToYear6Desperation,
  onSellEquipmentForPerseusFee,
  onOpenAcceptanceLetter,
  onConcludePublicationAndRestorePieces,
}) => {
  if (!colloquium.active || colloquium.stage === 'INACTIVE') return null;

  const selectedEmail =
    colloquium.inbox.find((e) => e.id === colloquium.selectedEmailId) ||
    colloquium.inbox[0];

  // ============================================================================
  // STAGE 1: THE WORLD COLLAPSES & FADES INTO THE MODEST UNIVERSITY OFFICE
  // ============================================================================
  if (colloquium.stage === 'WORLD_COLLAPSE_FADE') {
    return (
      <div className="pointer-events-auto fixed inset-0 z-50 bg-[#05070B]/95 backdrop-blur-md flex items-center justify-center p-6 overflow-y-auto">
        <div className="max-w-2xl w-full bg-[#0B0F17] border border-slate-800 rounded-2xl p-8 md:p-10 shadow-[0_0_90px_rgba(0,0,0,0.95)] text-slate-200 font-serif">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-amber-400/80 mb-4">
            REALITY COLLAPSE · THE CHESSBOARD DISSOLVES
          </div>

          <div className="space-y-4 text-base md:text-lg leading-relaxed text-slate-200">
            <p className="text-slate-400 italic">The screen fades.</p>
            <p>
              A modest university office. Rain against the windows. A coffee machine that hasn&rsquo;t worked since 1987.
            </p>
            <p>
              You&rsquo;re now <strong className="text-amber-300 font-semibold">Dr. Pawn</strong>, an untenured researcher at the{' '}
              <strong className="text-white font-semibold">University of Greater Andromeda</strong>.
            </p>
            <p>
              You have a salary (<span className="font-mono text-sm text-emerald-300">$48,200/yr</span>). A mortgage (<span className="font-mono text-sm text-rose-300">$2,140/mo</span>). A strained relationship with your department chair. A promising but controversial paper:{' '}
              <em className="text-sky-300">&ldquo;On the Nonexistence of Monarchs in Retrocausal Systems.&rdquo;</em>
            </p>
            <p>
              Your graduate student has just knocked on your door in the rain to inform you that the central lemma may be incorrect.
            </p>
            <p className="text-white font-bold pt-1">
              And the chess game is gone.
            </p>
            <p className="text-slate-400 text-sm">
              Not minimized. Not waiting behind a menu. <span className="text-slate-200 italic">Gone.</span>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800/90 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans">
            <div className="text-xs font-mono text-slate-400">
              📍 Room 4B, Peano Hall · Rainy Evening · Year 1 of Tenure Track
            </div>
            <button
              onClick={onEnterUniversityOffice}
              className="w-full sm:w-auto px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-extrabold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(245,158,11,0.35)]"
            >
              <span>Sit Down at Your Desk (Begin Year 1)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STAGE 4: THE ACCEPTANCE LETTER ("YOU DID IT. ...")
  // ============================================================================
  if (colloquium.stage === 'ACCEPTANCE_LETTER') {
    return (
      <div className="pointer-events-auto fixed inset-0 z-50 bg-[#05070B]/92 backdrop-blur-md flex items-center justify-center p-6 overflow-y-auto">
        <div className="max-w-2xl w-full bg-[#10141d] border-2 border-amber-400/70 rounded-2xl p-8 md:p-10 shadow-[0_0_90px_rgba(245,158,11,0.25)] text-slate-100">
          {/* Suspicious Outer Perseus Arm Letterhead */}
          <div className="border-b border-amber-500/30 pb-4 flex items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] tracking-[0.22em] text-amber-400 uppercase font-bold">
                GALACTIC ADVANCES IN THEORETICAL EVERYTHING
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                Suite 404-B, Outer Reaches of the Perseus Arm · ISSN 9941-000X
              </div>
            </div>
            <div className="text-right font-mono text-[10px] text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 rounded">
              <div>IMPACT FACTOR: 847.3</div>
              <div>ACCEPTANCE RATE: 100%</div>
            </div>
          </div>

          {/* The Official Letter Body */}
          <div className="mt-6 bg-[#f8f5ec] text-slate-900 rounded-xl p-6 font-serif shadow-inner border border-amber-200">
            <div className="text-xs font-mono text-slate-500 mb-3">
              DATE: Year 6, Late November · Payment of $6,500.00 (Lab Equipment Liquidation) CLEARED
            </div>
            <p className="text-base font-bold text-slate-900">Dear Dr. Pawn,</p>
            <p className="mt-3 text-base leading-relaxed text-slate-800">
              We are delighted to inform you that your manuscript,{' '}
              <strong>&ldquo;On the Nonexistence of Monarchs in Retrocausal Systems,&rdquo;</strong>{' '}
              has been accepted for publication.
            </p>
            <p className="mt-3 text-base font-bold text-slate-900">
              Your theorem is now formally recognized.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-300 flex items-center justify-between text-xs font-mono text-slate-600">
              <span>DOI: {colloquium.publishedDoi || '10.8473/gate.perseus.0001'}</span>
              <span>Peer Review: Waived Upon Request</span>
            </div>
          </div>

          {/* Emotional Narrative Sequence */}
          <div className="mt-6 space-y-2.5 font-serif text-base md:text-lg text-slate-200 pl-2 border-l-2 border-amber-400/60">
            <p className="italic text-slate-300">You smile.</p>
            <p className="italic text-slate-300">A tear rolls down your cheek.</p>
            <p className="text-slate-300">Six years of struggle.</p>
            <p className="text-amber-200 font-semibold">Finally.</p>
            <p className="text-2xl font-display font-extrabold tracking-wide text-white pt-1">
              YOU DID IT.
            </p>
            <p className="text-xl font-mono text-amber-400 tracking-widest">...</p>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={onConcludePublicationAndRestorePieces}
              className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-amber-400 via-sky-400 to-amber-300 hover:from-amber-300 hover:to-sky-300 text-slate-950 font-mono font-extrabold text-xs rounded-xl shadow-[0_0_30px_rgba(56,189,248,0.45)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>... (Return to the Chessboard &amp; Checkmate Yesterday)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STAGE 2 & 3: THE STANDALONE UNIVERSITY OF GREATER ANDROMEDA LIFE SIMULATOR
  // (Framing the live 3D Rainy University Office in the center viewport!)
  // ============================================================================
  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between">
      {/* 1. TOP UNIVERSITY OF GREATER ANDROMEDA FACULTY PORTAL HEADER (Replaces Chess Header Completely!) */}
      <header className="pointer-events-auto bg-[#090D14]/95 border-b border-slate-800 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/60 flex items-center justify-center text-amber-300">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-sm text-white tracking-wide">
                UNIVERSITY OF GREATER ANDROMEDA
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-amber-300">
                YEAR {colloquium.academicYear} OF 6 · {colloquium.semester.toUpperCase()} SEMESTER
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Dr. Pawn · Untenured Researcher · Room 4B, Peano Hall (Rainy) · Coffee Machine: Broken Since 1987
            </div>
          </div>
        </div>

        {/* Quantified Academic Life Metrics Bar */}
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-mono">
          <div
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1.5"
            title="Your frozen Assistant Professor salary and checking balance"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Checking:</span>
            <span className="text-emerald-300 font-bold">
              ${colloquium.checkingBalance.toLocaleString()}
            </span>
          </div>

          <div
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
              colloquium.checkingBalance < colloquium.monthlyMortgage
                ? 'bg-rose-950/80 border-rose-500/60 text-rose-200 animate-pulse'
                : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}
            title="Monthly Mortgage to Andromeda Savings & Loan ($2,140/mo)"
          >
            <Home className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-slate-400">Mortgage:</span>
            <span className="font-bold text-rose-300">${colloquium.monthlyMortgage}/mo</span>
          </div>

          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400">Dept Budget:</span>
            <span className="text-sky-300 font-bold">
              ${colloquium.departmentalBudget.toLocaleString()}
            </span>
          </div>

          <div
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1.5"
            title="Your h-index vs. newly tenured Prof. Rook (who published the exact same paper 3 times)"
          >
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">h-index:</span>
            <span className="text-amber-300 font-bold">{colloquium.hIndex}</span>
            <span className="text-slate-500">(Rook: {colloquium.rookHIndex})</span>
          </div>

          <div
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1.5"
            title="University Administration Quantified Faculty Productivity Metric"
          >
            <Award className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400">Admin KPI:</span>
            <span className="text-purple-300 font-bold">
              {colloquium.adminProductivityScore.toFixed(1)}%
            </span>
          </div>
        </div>
      </header>

      {/* 2. MIDDLE WORKSPACE: Left Inbox & Office Life + Center 3D Rainy Office Window + Right Research & Submission Desk */}
      <div className="flex-1 flex flex-col lg:flex-row items-stretch justify-between p-4 gap-4 overflow-hidden">
        {/* LEFT PANEL: UNIVERSITY EMAIL INBOX, COLLEAGUE POLITICS & THE 1987 COFFEE MACHINE */}
        <div className="pointer-events-auto w-full lg:w-[390px] bg-[#0B0F17]/92 border border-slate-800/90 rounded-2xl p-3.5 flex flex-col gap-3 shadow-2xl backdrop-blur-md overflow-y-auto max-h-[calc(100vh-155px)]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-300">
              <Mail className="w-4 h-4" />
              <span>UGA FACULTY PINE MAIL ({colloquium.inbox.length})</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Chair Rel: <strong className="text-rose-300">{colloquium.chairRelationship}% (Strained)</strong>
            </span>
          </div>

          {/* Email List */}
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {colloquium.inbox.map((item) => {
              const isSelected = item.id === selectedEmail?.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectEmail(item.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400/80 text-white'
                      : 'bg-slate-900/85 hover:bg-slate-800/90 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="font-bold text-amber-300 truncate">{item.sender}</span>
                    <span className="text-slate-400 shrink-0 ml-1">{item.dateLabel}</span>
                  </div>
                  <div className="text-xs font-semibold text-white truncate mt-0.5">
                    {item.subject}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Email Reader */}
          {selectedEmail && (
            <div className="bg-[#070A10] border border-slate-800 rounded-xl p-3 text-xs space-y-2 flex-1 min-h-[165px] overflow-y-auto">
              <div className="border-b border-slate-800/80 pb-1.5">
                <div className="font-bold text-white text-xs">{selectedEmail.subject}</div>
                <div className="text-[10px] font-mono text-slate-400">
                  From: {selectedEmail.sender} ({selectedEmail.senderRole})
                </div>
              </div>
              <div className="text-[11px] text-slate-300 whitespace-pre-line leading-relaxed font-serif">
                {selectedEmail.body}
              </div>
            </div>
          )}

          {/* Departmental Politics & The Broken 1987 Coffee Machine */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400">QUANTUM LAB (PROF. BISHOP):</span>
              <span
                className={
                  colloquium.bishopLabAccessGranted
                    ? 'text-emerald-300 font-bold'
                    : 'text-rose-300 font-bold'
                }
              >
                {colloquium.bishopLabAccessGranted
                  ? '✓ 3:00 AM KEYCARD ACCESS'
                  : '🔒 WITHHELD BY BISHOP'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400">REVIEWER #2 RIVALRY:</span>
              <span className="text-amber-300 font-bold">
                {colloquium.reviewer2RivalryLevel}% (Hostile)
              </span>
            </div>
            <button
              onClick={onKickCoffeeMachine}
              className="w-full px-2.5 py-1.5 bg-amber-950/60 hover:bg-amber-900/70 border border-amber-500/40 rounded-lg text-[10px] font-mono text-amber-200 flex items-center justify-between transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5 text-amber-400" />
                <span>Try 1987 Breakroom Coffee Machine</span>
              </span>
              <span className="text-rose-300">Broken ({colloquium.coffeeMachineKickCount})</span>
            </button>
          </div>
        </div>

        {/* CENTER VIEWPORT CAPTION: Lets the player admire the 3D Rainy Office, Chalkboard, Dr. Pawn & 1987 Coffee Maker */}
        <div className="hidden lg:flex flex-col justify-end items-center pb-2 flex-1 pointer-events-none">
          <div className="bg-[#070A10]/85 border border-slate-800/90 rounded-xl px-4 py-2 text-center max-w-md backdrop-blur-sm">
            <div className="text-[10px] font-mono text-amber-300/90 uppercase tracking-widest">
              ROOM 4B · SUB-BASEMENT OF PEANO HALL · RAIN AGAINST THE WINDOWS
            </div>
            <div className="text-xs text-slate-300 font-serif italic mt-0.5">
              {colloquium.colloquiumLog[0]}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: MANUSCRIPT PROGRESS, ACADEMIC ACTIONS & THE PERSEUS ARM PUBLISHER */}
        <div className="pointer-events-auto w-full lg:w-[430px] bg-[#0B0F17]/92 border border-slate-800/90 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl backdrop-blur-md overflow-y-auto max-h-[calc(100vh-155px)]">
          {/* Manuscript Card */}
          <div className="bg-[#111724] border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between text-[10px] font-mono text-sky-300">
              <span>WORKING PAPER · {colloquium.manuscriptVersion}</span>
              <span className="text-rose-300 font-bold">
                J. Transfinite Causality Rejections: {colloquium.journalRejections} / 3
              </span>
            </div>
            <div className="font-serif font-bold text-sm text-white mt-1">
              &ldquo;{colloquium.manuscriptTitle}&rdquo;
            </div>

            {/* Central Lemma Integrity Bar */}
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-300">Central Lemma 3.2 Proof Integrity:</span>
                <span
                  className={
                    colloquium.centralLemmaIntegrity >= 100
                      ? 'text-emerald-300 font-bold'
                      : 'text-amber-300 font-bold'
                  }
                >
                  {colloquium.centralLemmaIntegrity}%{' '}
                  {colloquium.centralLemmaIntegrity < 50
                    ? '(Grad Student Found Flaw!)'
                    : colloquium.centralLemmaIntegrity < 100
                    ? '(Needs Quantum Lab Test)'
                    : '(Verified!)'}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden mt-1 border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    colloquium.centralLemmaIntegrity >= 100
                      ? 'bg-emerald-400'
                      : 'bg-amber-400'
                  }`}
                  style={{ width: `${Math.min(100, colloquium.centralLemmaIntegrity)}%` }}
                />
              </div>
            </div>
          </div>

          {/* IF 3 REJECTIONS HAVE OCCURRED (YEAR 6 DESPERATION): SHOW SUSPICIOUS PERSEUS ARM PUBLISHER! */}
          {colloquium.stage === 'PERSEUS_ARM_OFFER' || colloquium.journalRejections >= 3 ? (
            <div className="bg-[#170F1E] border-2 border-fuchsia-400/80 rounded-xl p-3.5 space-y-3 shadow-[0_0_30px_rgba(217,70,239,0.25)]">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-400/60 text-[10px] font-mono font-bold text-rose-200">
                  YEAR 6 · 3RD REJECTION · DESPERATION SETS IN
                </span>
                <span className="text-[10px] font-mono text-fuchsia-300">Outer Perseus Arm</span>
              </div>

              <p className="text-xs text-slate-200 font-serif leading-relaxed">
                After six simulated years and your third rejection from the{' '}
                <em>Journal of Transfinite Causality</em>, a colleague by the broken 1987 coffee machine introduces you to a publisher operating out of a suspicious office in the outer reaches of the Perseus Arm:
              </p>

              <div className="bg-[#0B0711] border border-amber-400/60 rounded-xl p-3 font-mono text-xs space-y-1">
                <div className="text-amber-300 font-extrabold text-sm">
                  GALACTIC ADVANCES IN THEORETICAL EVERYTHING
                </div>
                <div className="text-emerald-300">Impact Factor: 847.3</div>
                <div className="text-sky-300">Acceptance Rate: 100%</div>
                <div className="text-fuchsia-300">Peer Review: Available Upon Request</div>
                <div className="text-rose-300 font-bold pt-1">
                  Publication Fee (APC): $6,500.00 (Wire Transfer Only)
                </div>
              </div>

              {!colloquium.equipmentSoldForFee ? (
                <button
                  onClick={onSellEquipmentForPerseusFee}
                  className="w-full px-3.5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-extrabold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-between shadow-lg"
                >
                  <span>Sell Your Research Equipment to Pay the Fee</span>
                  <span>+$6,500 →</span>
                </button>
              ) : (
                <button
                  onClick={onOpenAcceptanceLetter}
                  className="w-full px-4 py-3 bg-gradient-to-r from-emerald-400 to-sky-400 hover:from-emerald-300 hover:to-sky-300 text-slate-950 font-mono font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-between shadow-[0_0_25px_rgba(52,211,153,0.4)] animate-pulse"
                >
                  <span>📨 Paper Accepted! Open the Acceptance Letter</span>
                  <span>Read Letter →</span>
                </button>
              )}
            </div>
          ) : (
            /* STANDARD YEARS 1–6 ACADEMIC LIFE SIMULATOR ACTIONS */
            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Academic Career &amp; Department Actions (Years 1–6):
              </div>

              {/* Action 1: Work with Grad Student on Central Lemma */}
              <button
                onClick={onWorkOnCentralLemma}
                className="w-full text-left px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/90 transition-colors cursor-pointer flex items-center justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Re-Derive Central Lemma 3.2 with Grad Student</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Fix the Jacobian sign error over rainy late-night chalk sessions (-$400 Dept. Budget)
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-emerald-300 shrink-0">
                  +30% Lemma
                </span>
              </button>

              {/* Action 2: Confront Prof. Bishop for Quantum Lab Access */}
              <button
                onClick={onConfrontBishopForLab}
                className="w-full text-left px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/90 transition-colors cursor-pointer flex items-center justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      {colloquium.bishopLabAccessGranted
                        ? 'Run Retrocausal Interferometer in Quantum Lab'
                        : 'Confront Prof. Bishop Over Quantum Lab Access'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {colloquium.bishopLabAccessGranted
                      ? 'Verify the nonexistence of monarchs at t₀ − 1 (+Lemma & +h-index)'
                      : 'Discover why Prof. Bishop is deliberately withholding the lab keycard'}
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-sky-300 shrink-0">
                  {colloquium.bishopLabAccessGranted ? '+1 h-index' : 'Unlock Lab'}
                </span>
              </button>

              {/* Action 3: Grant Applications & Mortgage Payment */}
              <button
                onClick={onApplyForGrantAndPayMortgage}
                className="w-full text-left px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/90 transition-colors cursor-pointer flex items-center justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Write Grant Proposal &amp; Pay $2,140 Mortgage</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Appease Chairwoman Queen&rsquo;s 58% overhead demand &amp; keep your townhouse
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-emerald-300 shrink-0">
                  +$2,800 Budget
                </span>
              </button>

              {/* Action 4: Conference Politics & Prof. Rook's Identical Papers */}
              <button
                onClick={onAttendConferenceAndDebateRook}
                className="w-full text-left px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/90 transition-colors cursor-pointer flex items-center justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    <span>Attend Conference &amp; Debate Reviewer #2</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Watch Prof. Rook get applauded for publishing the same paper {colloquium.rookIdenticalPapersCount} times
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-purple-300 shrink-0">
                  +2 h-index
                </span>
              </button>

              {/* Action 5: Submit to the Journal of Transfinite Causality */}
              <button
                onClick={onSubmitToJournalOfTransfiniteCausality}
                className="w-full px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/30 to-rose-500/30 hover:from-amber-500/45 hover:to-rose-500/45 border border-amber-400/80 transition-colors cursor-pointer flex items-center justify-between gap-2 shadow-md"
              >
                <div className="text-left">
                  <div className="text-xs font-mono font-extrabold text-amber-200">
                    Submit to &ldquo;Journal of Transfinite Causality&rdquo; (Attempt #{colloquium.journalRejections + 1} of 3)
                  </div>
                  <div className="text-[10px] text-slate-300 mt-0.5">
                    Advances tenure clock by ~2 simulated years · Awaits Reviewer #2&rsquo;s verdict
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-amber-300 shrink-0">
                  Submit →
                </span>
              </button>

              {/* Quick Fast-Forward to Year 6 Desperation */}
              <button
                onClick={onFastForwardToYear6Desperation}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-400 hover:text-amber-200 transition-colors cursor-pointer text-center"
              >
                ⏩ Fast-Forward Through 6 Years &amp; 3 Rejections → Outer Perseus Arm Publisher
              </button>
            </div>
          )}

          {/* Recent Academic Life Chronicle */}
          <div className="mt-auto pt-2 border-t border-slate-800/80 space-y-1">
            <div className="text-[10px] font-mono text-slate-400 uppercase">
              Academic Life Log (You Have Forgotten the Chessboard Ever Existed):
            </div>
            {colloquium.colloquiumLog.slice(0, 3).map((entry, i) => (
              <div key={i} className="text-[11px] text-slate-300 font-serif leading-snug">
                {entry}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
