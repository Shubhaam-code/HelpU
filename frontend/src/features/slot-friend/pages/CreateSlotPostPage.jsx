import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  BookOpen, Clock, UserCheck, CheckCircle2, AlertCircle, 
  ArrowLeft, Plus, Sparkles, HelpCircle 
} from 'lucide-react';
import { SlotFriendHeader } from '../components/SlotFriendHeader';
import { useSlotFriend } from '../context/SlotFriendContext';

export default function CreateSlotPostPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editPostId = searchParams.get('edit');

  const { 
    courses, 
    teachers, 
    slotDefinitions, 
    myPosts, 
    createPost, 
    updatePost 
  } = useSlotFriend();

  // Editing existing post?
  const existingPost = editPostId ? myPosts.find((p) => p.id === editPostId) : null;

  // Form State
  const [selectedCourse, setSelectedCourse] = useState('');
  const [customCourse, setCustomCourse] = useState('');
  const [isCustomCourse, setIsCustomCourse] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState('');
  
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [customTeacher, setCustomTeacher] = useState('');
  const [isCustomTeacher, setIsCustomTeacher] = useState(false);

  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-populate if editing
  useEffect(() => {
    if (existingPost) {
      if (courses.includes(existingPost.course)) {
        setSelectedCourse(existingPost.course);
        setIsCustomCourse(false);
      } else {
        setSelectedCourse('__custom__');
        setCustomCourse(existingPost.course);
        setIsCustomCourse(true);
      }

      setSelectedSlot(existingPost.slot);

      if (teachers.includes(existingPost.teacher)) {
        setSelectedTeacher(existingPost.teacher);
        setIsCustomTeacher(false);
      } else {
        setSelectedTeacher('__custom__');
        setCustomTeacher(existingPost.teacher);
        setIsCustomTeacher(true);
      }

      setNotes(existingPost.notes || '');
    }
  }, [existingPost, courses, teachers]);

  const handleCourseChange = (val) => {
    if (val === '__custom__') {
      setIsCustomCourse(true);
      setSelectedCourse('__custom__');
    } else {
      setIsCustomCourse(false);
      setSelectedCourse(val);
      setCustomCourse('');
    }
    if (errors.course) setErrors((prev) => ({ ...prev, course: null }));
  };

  const handleTeacherChange = (val) => {
    if (val === '__custom__') {
      setIsCustomTeacher(true);
      setSelectedTeacher('__custom__');
    } else {
      setIsCustomTeacher(false);
      setSelectedTeacher(val);
      setCustomTeacher('');
    }
    if (errors.teacher) setErrors((prev) => ({ ...prev, teacher: null }));
  };

  const handleSlotSelect = (slotId) => {
    setSelectedSlot(slotId);
    if (errors.slot) setErrors((prev) => ({ ...prev, slot: null }));
  };

  const validate = () => {
    const errs = {};
    const finalCourse = isCustomCourse ? customCourse.trim() : selectedCourse.trim();
    if (!finalCourse || finalCourse === '__custom__') {
      errs.course = 'Please choose or enter a valid subject/course.';
    }

    if (!selectedSlot.trim()) {
      errs.slot = 'Please select your registered timetable slot (e.g., A1, B1, A2).';
    }

    const finalTeacher = isCustomTeacher ? customTeacher.trim() : selectedTeacher.trim();
    if (!finalTeacher || finalTeacher === '__custom__') {
      errs.teacher = 'Please select or enter the faculty / teacher name.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    const finalCourse = isCustomCourse ? customCourse.trim() : selectedCourse.trim();
    const finalTeacher = isCustomTeacher ? customTeacher.trim() : selectedTeacher.trim();

    try {
      if (existingPost) {
        updatePost(existingPost.id, {
          course: finalCourse,
          slot: selectedSlot.trim(),
          teacher: finalTeacher,
          notes,
        });
      } else {
        createPost({
          course: finalCourse,
          slot: selectedSlot.trim(),
          teacher: finalTeacher,
          notes,
        });
      }

      // Navigate directly to matches for immediate gratification
      navigate('/slot-friend/matches');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8F3] pb-24 md:pb-16">
      <SlotFriendHeader 
        title={existingPost ? 'Edit Slot Post' : 'Create Slot Post'} 
        subtitle="Specify course, slot and teacher to discover identical peers"
        backTo="/slot-friend"
      />

      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 pt-3 sm:pt-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-[24px] sm:rounded-[28px] border border-[#F4E3D8] shadow-xs p-4 sm:p-6 space-y-6"
        >
          {/* Header Note */}
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#FFF8F3] border border-[#FDD0BE]">
            <Sparkles className="w-5 h-5 text-[#FF572E] shrink-0 mt-0.5" />
            <div className="text-xs text-[#6E7587] leading-relaxed">
              <strong className="text-[#17233C]">How matching works:</strong> We match students who share the 
              <strong> exact same course and slot</strong>. Even if your faculty is different, lecture timings 
              and syllabus align, making it easy to share notes and solve doubts!
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ================================================================= */}
            {/* 1. COURSE SELECTION                                               */}
            {/* ================================================================= */}
            <div className="space-y-2">
              <label className="block text-xs sm:text-sm font-black text-[#17233C]">
                1. Select Course / Subject <span className="text-[#FF572E]">*</span>
              </label>

              <select
                value={selectedCourse}
                onChange={(e) => handleCourseChange(e.target.value)}
                className={`w-full px-3.5 py-3 rounded-xl bg-[#FFFBF8] border text-xs sm:text-sm font-semibold text-[#17233C] focus:outline-none focus:ring-2 focus:ring-[#FF572E]/20 transition-all cursor-pointer ${
                  errors.course ? 'border-red-500' : 'border-[#F4E3D8] focus:border-[#FF572E]'
                }`}
              >
                <option value="">-- Choose registered subject --</option>
                {courses.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
                <option value="__custom__">➕ Other / Enter custom course code</option>
              </select>

              {isCustomCourse && (
                <div className="pt-2">
                  <input
                    type="text"
                    value={customCourse}
                    onChange={(e) => {
                      setCustomCourse(e.target.value);
                      if (errors.course) setErrors((prev) => ({ ...prev, course: null }));
                    }}
                    placeholder="Enter Course Code & Name (e.g., CSE3005 - Software Engineering)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#F4E3D8] text-xs sm:text-sm font-semibold text-[#17233C] placeholder:text-[#8C93A4] focus:outline-none focus:border-[#FF572E] focus:ring-2 focus:ring-[#FF572E]/20"
                  />
                </div>
              )}

              {errors.course && (
                <p className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.course}</span>
                </p>
              )}
            </div>

            {/* ================================================================= */}
            {/* 2. SLOT SELECTION (VISUAL GRID & DETAILS)                         */}
            {/* ================================================================= */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs sm:text-sm font-black text-[#17233C]">
                  2. Choose Registered Slot <span className="text-[#FF572E]">*</span>
                </label>
                {selectedSlot && (
                  <span className="text-[11px] font-black text-[#FF572E] bg-[#FFF0E6] px-2 py-0.5 rounded-full border border-[#FDD0BE]">
                    Selected: {selectedSlot}
                  </span>
                )}
              </div>

              {/* Slot Cards Grid */}
              <div className="grid grid-cols-3 min-[430px]:grid-cols-4 sm:grid-cols-7 gap-2">
                {slotDefinitions.map((slot) => {
                  const isSelected = selectedSlot === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => handleSlotSelect(slot.id)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                        isSelected
                          ? 'bg-[#FF572E] border-[#FF572E] text-white shadow-sm font-black'
                          : 'bg-[#FFFBF8] border-[#F4E3D8] text-[#17233C] hover:border-[#FF572E]/40 font-bold'
                      }`}
                    >
                      <span className="text-xs sm:text-sm tracking-tight">{slot.id}</span>
                      <span className={`text-[9px] truncate max-w-full ${isSelected ? 'text-white/80' : 'text-[#8C93A4]'}`}>
                        {slot.type.includes('Morning') ? 'Morn' : (slot.type.includes('Lab') ? 'Lab' : 'Eve')}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Display Selected Slot Timings */}
              {selectedSlot && (
                <div className="p-3 rounded-xl bg-[#FFF8F3] border border-[#FDD0BE] text-xs flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#FF572E] shrink-0" />
                  <span className="text-[#17233C] font-semibold">
                    <strong>Timings:</strong> {slotDefinitions.find((s) => s.id === selectedSlot)?.timings || 'Standard lecture slot'}
                  </span>
                </div>
              )}

              {errors.slot && (
                <p className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.slot}</span>
                </p>
              )}
            </div>

            {/* ================================================================= */}
            {/* 3. TEACHER / FACULTY SELECTION                                    */}
            {/* ================================================================= */}
            <div className="space-y-2">
              <label className="block text-xs sm:text-sm font-black text-[#17233C]">
                3. Faculty / Teacher <span className="text-[#FF572E]">*</span>
              </label>

              <select
                value={selectedTeacher}
                onChange={(e) => handleTeacherChange(e.target.value)}
                className={`w-full px-3.5 py-3 rounded-xl bg-[#FFFBF8] border text-xs sm:text-sm font-semibold text-[#17233C] focus:outline-none focus:ring-2 focus:ring-[#FF572E]/20 transition-all cursor-pointer ${
                  errors.teacher ? 'border-red-500' : 'border-[#F4E3D8] focus:border-[#FF572E]'
                }`}
              >
                <option value="">-- Choose Course Instructor --</option>
                {teachers.map((teacher) => (
                  <option key={teacher} value={teacher}>
                    {teacher}
                  </option>
                ))}
                <option value="__custom__">➕ Other / Enter custom teacher name</option>
              </select>

              {isCustomTeacher && (
                <div className="pt-2">
                  <input
                    type="text"
                    value={customTeacher}
                    onChange={(e) => {
                      setCustomTeacher(e.target.value);
                      if (errors.teacher) setErrors((prev) => ({ ...prev, teacher: null }));
                    }}
                    placeholder="Enter Faculty Name & Department (e.g., Dr. R. K. Sharma)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#F4E3D8] text-xs sm:text-sm font-semibold text-[#17233C] placeholder:text-[#8C93A4] focus:outline-none focus:border-[#FF572E] focus:ring-2 focus:ring-[#FF572E]/20"
                  />
                </div>
              )}

              {errors.teacher && (
                <p className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.teacher}</span>
                </p>
              )}
            </div>

            {/* ================================================================= */}
            {/* 4. OPTIONAL NOTES / STUDY GOALS                                   */}
            {/* ================================================================= */}
            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-black text-[#17233C]">
                4. Study Goal or Note <span className="text-[#8C93A4] font-normal">(Optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g., Looking for someone to sit together in lectures, review lab assignments, and study for CAT 1 & 2 exams."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFBF8] border border-[#F4E3D8] text-xs sm:text-sm font-medium text-[#17233C] placeholder:text-[#8C93A4] focus:outline-none focus:border-[#FF572E] focus:ring-2 focus:ring-[#FF572E]/20 resize-none"
              />
            </div>

            {/* Submit Action */}
            <div className="pt-3 border-t border-[#F4E3D8]/60 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/slot-friend')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-[#F4E3D8] text-xs font-bold text-[#6E7587] hover:bg-[#FFF8F3] transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-7 py-3 rounded-full bg-[#FF572E] hover:bg-[#E64A22] active:scale-98 text-white text-xs sm:text-sm font-black shadow-md shadow-[#FF572E]/25 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>{existingPost ? 'Save Changes' : 'Create Slot Post'}</span>
              </button>
            </div>

          </form>
        </motion.div>
      </div>
    </div>
  );
}

