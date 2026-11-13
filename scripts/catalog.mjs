// The exercise catalog: every exercise we can do on our equipment.
// Columns: key, name, muscle group, station, measure, options
//   group    which weekly set target the exercise counts toward
//   station  barbell | smith | cable | landmine | dumbbell | bodyweight
//   measure  wr = weight x reps, bw = bodyweight reps (optional added weight),
//            time = seconds, carry = weight carried for time
//   options  src: name in free-exercise-db to take images and steps from
//            side: done one side at a time     needs: extra requirement
//            setup: note for our RitFit M1 Pro  steps: our own steps when no src
//            cues: common mistakes (main lifts)
const x = (key, name, group, station, measure, o = {}) => ({ key, name, group, station, measure, ...o })

export const catalog = [
  // ---- squat pattern ----
  x('barbell_back_squat', 'Barbell back squat', 'quads', 'barbell', 'wr', { src: 'Barbell Squat', setup: 'J-hooks just below shoulder height. Set the safety arms one hole below the bar at the bottom of your squat and test with an empty bar.', cues: ['Knees caving inward on the way up', 'Heels lifting off the floor', 'Cutting the depth short as the weight goes up'] }),
  x('smith_squat', 'Smith squat', 'quads', 'smith', 'wr', { src: 'Smith Machine Squat', setup: 'Feet a little in front of the bar. Rotate the bar to unhook; rotate back onto the hooks to finish.' }),
  x('goblet_squat', 'Goblet squat', 'quads', 'dumbbell', 'wr', { src: 'Goblet Squat', setup: 'Hold one dumbbell upright against your chest.' }),
  x('heels_raised_goblet_squat', 'Heels-raised goblet squat', 'quads', 'dumbbell', 'wr', { src: 'Goblet Squat', setup: 'Heels on a 10 or 15 lb plate to shift the work onto the quads.' }),
  x('db_front_squat', 'Dumbbell front squat', 'quads', 'dumbbell', 'wr', { steps: ['Hold a dumbbell on each shoulder, elbows pointing forward.', 'Sit straight down between your hips, keeping your chest tall.', 'Go as deep as you can with heels down, then stand by driving through the whole foot.'] }),
  x('landmine_squat', 'Landmine squat', 'quads', 'landmine', 'wr', { setup: 'Barbell in the landmine pivot, plates on the free end only.', steps: ['Cup the end of the bar in both hands at chest height and lean slightly into it.', 'Squat down between your hips, elbows inside your knees.', 'Stand up, keeping the bar close to your chest.'] }),

  // ---- hinge pattern ----
  x('barbell_rdl', 'Barbell Romanian deadlift', 'hamstrings', 'barbell', 'wr', { src: 'Romanian Deadlift', setup: 'Take the bar from the J-hooks at mid-thigh height so you start standing.', cues: ['Rounding the lower back to reach lower', 'Bending the knees so it becomes a squat', 'Letting the bar drift away from the legs'] }),
  x('db_rdl', 'Dumbbell Romanian deadlift', 'hamstrings', 'dumbbell', 'wr', { src: 'Stiff-Legged Dumbbell Deadlift' }),
  x('smith_rdl', 'Smith Romanian deadlift', 'hamstrings', 'smith', 'wr', { src: 'Smith Machine Stiff-Legged Deadlift', setup: 'Start from a hook at mid-thigh height.' }),
  x('single_leg_rdl', 'Single-leg dumbbell Romanian deadlift', 'hamstrings', 'dumbbell', 'wr', { side: true, steps: ['Stand on one leg holding a dumbbell in the opposite hand.', 'Hinge at the hip, sending the free leg straight back as the dumbbell lowers toward the floor.', 'Keep your hips level and back flat, then stand tall by squeezing the glute of the standing leg.'] }),
  x('barbell_deadlift', 'Barbell deadlift', 'hamstrings', 'barbell', 'wr', { src: 'Barbell Deadlift', setup: 'From the floor on bumper plates, outside the rack. Use at least the 25 lb bumpers so the bar sits at a workable height; if lighter, raise the bar on spare plates.', cues: ['Jerking the bar off the floor instead of squeezing it up', 'Rounding the lower back', 'Hips shooting up before the bar moves'] }),
  x('db_deadlift', 'Dumbbell deadlift', 'hamstrings', 'dumbbell', 'wr', { steps: ['Stand with a dumbbell outside each foot.', 'Hinge and bend the knees to grip them, back flat and chest up.', 'Stand up by pushing the floor away, then lower under control.'] }),
  x('good_morning', 'Barbell good morning', 'lower_back', 'barbell', 'wr', { src: 'Good Morning', setup: 'Light. Bar on the upper back from the J-hooks, safety arms set at hip height.' }),

  // ---- single leg ----
  x('bulgarian_split_squat', 'Bulgarian split squat', 'quads', 'dumbbell', 'wr', { side: true, src: 'Split Squat with Dumbbells', setup: 'Rear foot on the flat bench.' }),
  x('reverse_lunge', 'Dumbbell reverse lunge', 'quads', 'dumbbell', 'wr', { side: true, src: 'Dumbbell Rear Lunge' }),
  x('db_step_up', 'Dumbbell step-up', 'quads', 'dumbbell', 'wr', { side: true, src: 'Dumbbell Step Ups', setup: 'Step onto the flat bench, pushed against the rack so it cannot slide.' }),
  x('walking_lunge', 'Dumbbell walking lunge', 'quads', 'dumbbell', 'wr', { side: true, src: 'Dumbbell Lunges' }),
  x('cossack_squat', 'Cossack squat', 'hips', 'dumbbell', 'wr', { side: true, steps: ['Stand with feet wide, holding one dumbbell at your chest.', 'Shift your weight onto one leg and sit down over it, keeping that heel down while the other leg stays straight with toes up.', 'Push back to the middle and repeat on the other side.'] }),
  x('lateral_lunge', 'Dumbbell lateral lunge', 'hips', 'dumbbell', 'wr', { side: true, steps: ['Stand tall holding a dumbbell at your chest.', 'Step out to one side and sit back into that hip, keeping the trailing leg straight.', 'Push off the bent leg to return to standing.'] }),

  // ---- glutes ----
  x('smith_hip_thrust', 'Smith hip thrust', 'glutes', 'smith', 'wr', { src: 'Barbell Hip Thrust', setup: 'Upper back on the long edge of the flat bench, Smith bar across the hips on its lowest hooks. Pad the bar with a towel.' }),
  x('barbell_glute_bridge', 'Barbell glute bridge', 'glutes', 'barbell', 'wr', { src: 'Barbell Glute Bridge' }),
  x('cable_pull_through', 'Cable pull-through', 'glutes', 'cable', 'wr', { src: 'Pull Through', setup: 'Trolley at the lowest position, rope attachment. Face away from the machine.' }),
  x('cable_kickback', 'Cable glute kickback', 'glutes', 'cable', 'wr', { side: true, needs: 'ankle_strap', src: 'One-Legged Cable Kickback', setup: 'Trolley at the lowest position, ankle strap. Hold the upright for balance.' }),

  // ---- hamstring curls ----
  x('cable_leg_curl', 'Standing cable leg curl', 'hamstrings', 'cable', 'wr', { side: true, needs: 'ankle_strap', setup: 'Trolley at the lowest position, ankle strap. Face the machine and hold the upright.', steps: ['Strap the cable to one ankle and stand facing the machine.', 'Keeping your thigh still, curl your heel toward your glute.', 'Lower slowly until the leg is straight again.'] }),
  x('db_leg_curl', 'Dumbbell lying leg curl', 'hamstrings', 'dumbbell', 'wr', { setup: 'Lie face down on the flat bench with your knees just off the end. Your partner places the dumbbell between your feet.', steps: ['Squeeze the dumbbell between your feet with legs straight.', 'Curl your heels toward your glutes without lifting your hips.', 'Lower slowly. Start light; this is harder than it looks.'] }),
  x('nordic_lowering', 'Partner Nordic lowering', 'hamstrings', 'bodyweight', 'bw', { needs: 'partner', steps: ['Kneel on a pad with your partner holding your ankles down.', 'Keeping a straight line from knees to head, lower yourself toward the floor as slowly as you can.', 'Catch yourself with your hands, push back up, and repeat.'] }),

  // ---- calves ----
  x('smith_calf_raise', 'Smith calf raise', 'calves', 'smith', 'wr', { src: 'Smith Machine Calf Raise', setup: 'Balls of the feet on a bumper plate under the bar.' }),
  x('db_calf_raise', 'Single-leg dumbbell calf raise', 'calves', 'dumbbell', 'wr', { side: true, src: 'Standing Dumbbell Calf Raise', setup: 'One foot on a bumper plate, dumbbell in the same-side hand, other hand on the rack.' }),
  x('seated_db_calf_raise', 'Seated dumbbell calf raise', 'calves', 'dumbbell', 'wr', { src: 'Dumbbell Seated One-Leg Calf Raise' }),

  // ---- hips ----
  x('cable_hip_abduction', 'Cable hip abduction', 'hips', 'cable', 'wr', { side: true, needs: 'ankle_strap', setup: 'Trolley at the lowest position, strap on the outside ankle, standing side-on to the machine.', steps: ['Stand side-on with the strap on the leg furthest from the machine.', 'Keeping your body upright, lift that leg straight out to the side.', 'Lower slowly without letting the weight rest.'] }),
  x('cable_hip_adduction', 'Cable hip adduction', 'hips', 'cable', 'wr', { side: true, needs: 'ankle_strap', src: 'Cable Hip Adduction', setup: 'Trolley at the lowest position, strap on the ankle nearest the machine.' }),
  x('copenhagen_plank', 'Copenhagen plank', 'hips', 'bodyweight', 'time', { side: true, steps: ['Lie on your side with your top knee resting on the flat bench and your forearm on the floor.', 'Lift your hips so your body is straight, the bottom leg hanging under the bench.', 'Hold, then switch sides.'] }),

  // ---- lower back ----
  x('bird_dog', 'Bird dog', 'lower_back', 'bodyweight', 'bw', { side: true, steps: ['Start on hands and knees with a flat back.', 'Reach one arm forward and the opposite leg back until both are level with your body.', 'Pause for a second without letting your hips twist, then switch sides.'] }),
  x('superman_hold', 'Superman hold', 'lower_back', 'bodyweight', 'time', { src: 'Superman' }),

  // ---- horizontal press ----
  x('barbell_bench', 'Barbell bench press', 'chest', 'barbell', 'wr', { src: 'Barbell Bench Press - Medium Grip', setup: 'Flat bench centered in the rack. J-hooks where you can unrack with arms almost straight. Safety arms just below chest height, or use a spotter.', cues: ['Bouncing the bar off the chest', 'Elbows flared straight out to the sides', 'Lifting the hips off the bench'] }),
  x('smith_bench', 'Smith bench press', 'chest', 'smith', 'wr', { src: 'Smith Machine Bench Press', setup: 'Flat bench under the bar so it meets your mid-chest. Set a lower hook as the safety stop.' }),
  x('db_bench', 'Dumbbell bench press', 'chest', 'dumbbell', 'wr', { src: 'Dumbbell Bench Press' }),
  x('incline_barbell_bench', 'Incline barbell bench press', 'chest', 'barbell', 'wr', { src: 'Barbell Incline Bench Press - Medium Grip', setup: 'Bench at about 30 degrees. J-hooks and safety arms reset for the incline.' }),
  x('incline_db_press', 'Incline dumbbell press', 'chest', 'dumbbell', 'wr', { src: 'Incline Dumbbell Press', setup: 'Bench at about 30 degrees.' }),
  x('push_up', 'Push-up', 'chest', 'bodyweight', 'bw', { src: 'Pushups' }),
  x('cable_fly', 'Cable fly', 'chest', 'cable', 'wr', { src: 'Cable Crossover', setup: 'Both trolleys just above shoulder height, D-handles.' }),
  x('dips', 'Dips', 'triceps', 'bodyweight', 'bw', { src: 'Dips - Triceps Version', setup: 'Dip handles on the rear cross beam.' }),

  // ---- vertical press ----
  x('barbell_ohp', 'Barbell overhead press', 'shoulders', 'barbell', 'wr', { src: 'Standing Military Press', setup: 'Standing, bar taken from the J-hooks at upper-chest height. Step back clear of the hooks.', cues: ['Leaning back and turning it into an incline press', 'Pressing the bar forward instead of straight up past the face', 'Loose glutes and abs'] }),
  x('smith_ohp', 'Smith overhead press', 'shoulders', 'smith', 'wr', { src: 'Smith Machine Overhead Shoulder Press', setup: 'Bench upright under the bar.' }),
  x('db_shoulder_press', 'Seated dumbbell shoulder press', 'shoulders', 'dumbbell', 'wr', { src: 'Dumbbell Shoulder Press', setup: 'Bench upright.' }),
  x('landmine_press', 'Landmine press', 'shoulders', 'landmine', 'wr', { side: true, setup: 'Barbell in the landmine pivot, plates on the free end only.', steps: ['Stand facing the pivot holding the end of the bar at your shoulder with one hand.', 'Press the bar up and forward until your arm is straight.', 'Lower it back to the shoulder under control.'] }),

  // ---- vertical pull ----
  x('pull_up', 'Pull-up', 'back', 'bodyweight', 'bw', { src: 'Pullups', setup: 'Add weight by holding a dumbbell between your feet once 12 reps is easy.', cues: ['Half reps that stop short of a full hang', 'Swinging or kicking to get up', 'Shrugging the shoulders toward the ears'] }),
  x('chin_up', 'Chin-up', 'back', 'bodyweight', 'bw', { src: 'Chin-Up' }),
  x('lat_pulldown', 'Lat pulldown', 'back', 'cable', 'wr', { src: 'Wide-Grip Lat Pulldown', setup: 'Both trolleys at the top with the lat bar clipped across them, or one trolley for a single cable. Kneel, or sit on the bench or floor.', cues: ['Leaning far back and rowing it', 'Pulling with the arms before the shoulder blades', 'Letting the weight yank the arms up'] }),
  x('neutral_pulldown', 'Neutral-grip pulldown', 'back', 'cable', 'wr', { src: 'V-Bar Pulldown', setup: 'One trolley at the top with the V-handle.' }),

  // ---- horizontal pull ----
  x('barbell_row', 'Barbell bent-over row', 'back', 'barbell', 'wr', { src: 'Bent Over Barbell Row' }),
  x('tbar_row', 'Landmine T-bar row', 'back', 'landmine', 'wr', { src: 'T-Bar Row with Handle', setup: 'Barbell in the landmine pivot, landmine handle clamped under the plates.' }),
  x('db_row', 'Single-arm dumbbell row', 'back', 'dumbbell', 'wr', { side: true, src: 'One-Arm Dumbbell Row', setup: 'One knee and hand on the flat bench.' }),
  x('seated_cable_row', 'Seated cable row', 'back', 'cable', 'wr', { src: 'Seated Cable Rows', setup: 'Trolley at the lowest position, close-grip row handle, feet on the low row foot tube.' }),

  // ---- shoulders ----
  x('db_lateral_raise', 'Dumbbell lateral raise', 'shoulders', 'dumbbell', 'wr', { src: 'Side Lateral Raise' }),
  x('cable_lateral_raise', 'Single-arm cable lateral raise', 'shoulders', 'cable', 'wr', { side: true, src: 'Standing Low-Pulley Deltoid Raise', setup: 'Trolley at the lowest position, D-handle, standing side-on.' }),
  x('db_upright_row', 'Dumbbell upright row', 'shoulders', 'dumbbell', 'wr', { src: 'Standing Dumbbell Upright Row' }),
  x('face_pull', 'Rope face pull', 'shoulders', 'cable', 'wr', { src: 'Face Pull', setup: 'Trolley at upper-chest height, rope attachment.' }),
  x('reverse_fly', 'Bent-over dumbbell reverse fly', 'shoulders', 'dumbbell', 'wr', { src: 'Reverse Flyes' }),
  x('cable_external_rotation', 'Cable external rotation', 'shoulders', 'cable', 'wr', { side: true, src: 'External Rotation with Cable', setup: 'Trolley at elbow height, D-handle. Very light.' }),

  // ---- arms ----
  x('barbell_curl', 'Barbell curl', 'biceps', 'barbell', 'wr', { src: 'Barbell Curl' }),
  x('incline_db_curl', 'Incline dumbbell curl', 'biceps', 'dumbbell', 'wr', { src: 'Incline Dumbbell Curl', setup: 'Bench at about 60 degrees.' }),
  x('hammer_curl', 'Hammer curl', 'biceps', 'dumbbell', 'wr', { src: 'Hammer Curls' }),
  x('cable_curl', 'Cable curl', 'biceps', 'cable', 'wr', { src: 'Standing Biceps Cable Curl', setup: 'Trolley at the lowest position, short straight bar.' }),
  x('rope_pushdown', 'Rope pushdown', 'triceps', 'cable', 'wr', { src: 'Triceps Pushdown - Rope Attachment', setup: 'Trolley at the top, rope attachment.' }),
  x('overhead_rope_extension', 'Overhead rope extension', 'triceps', 'cable', 'wr', { src: 'Cable Rope Overhead Triceps Extension', setup: 'Trolley at the lowest position, rope attachment, facing away.' }),
  x('db_skull_crusher', 'Dumbbell skull crusher', 'triceps', 'dumbbell', 'wr', { src: 'Lying Dumbbell Tricep Extension' }),

  // ---- grip ----
  x('farmer_carry', 'Farmer carry', 'forearms', 'dumbbell', 'carry', { src: "Farmer's Walk", setup: 'A heavy dumbbell in each hand. Walk laps of the garage.' }),
  x('dead_hang', 'Dead hang', 'forearms', 'bodyweight', 'time', { steps: ['Grip the pull-up bar with both hands and hang with arms straight.', 'Keep your shoulders slightly pulled down, not jammed up by your ears.', 'Hold for time.'] }),
  x('db_shrug', 'Dumbbell shrug', 'forearms', 'dumbbell', 'wr', { src: 'Dumbbell Shrug' }),
  x('wrist_curl', 'Dumbbell wrist curl', 'forearms', 'dumbbell', 'wr', { src: 'Seated Dumbbell Palms-Up Wrist Curl' }),

  // ---- core ----
  x('hanging_leg_raise', 'Hanging leg raise', 'core', 'bodyweight', 'bw', { src: 'Hanging Leg Raise', setup: 'Start with knees bent. Progress to straight legs, then toes toward the bar.', cues: ['Swinging to build momentum', 'Only lifting the knees to hip height without curling the pelvis up', 'Dropping the legs instead of lowering them'] }),
  x('lying_leg_raise', 'Lying leg raise', 'core', 'bodyweight', 'bw', { src: 'Flat Bench Lying Leg Raise' }),
  x('barbell_rollout', 'Barbell rollout', 'core', 'barbell', 'bw', { src: 'Barbell Ab Rollout - On Knees', setup: 'Barbell on the floor with a 10 lb bumper each side so it rolls. Kneel on a pad. Start with a short range.', cues: ['Letting the lower back sag as you roll out', 'Rolling further than you can pull back from', 'Bending at the hips to cheat the return'] }),
  x('plank', 'Plank', 'core', 'bodyweight', 'time', { src: 'Plank' }),
  x('hollow_hold', 'Hollow hold', 'core', 'bodyweight', 'time', { steps: ['Lie on your back and press your lower back flat into the floor.', 'Lift your shoulders and straight legs a few inches off the floor, arms reaching past your head.', 'Hold the position without letting your lower back arch. Bend the knees to make it easier.'] }),
  x('dead_bug', 'Dead bug', 'core', 'bodyweight', 'bw', { side: true, src: 'Dead Bug' }),
  x('landmine_rotation', 'Landmine rotation', 'core', 'landmine', 'wr', { src: "Landmine 180's", setup: 'Barbell in the landmine pivot, light plate on the free end.' }),
  x('cable_woodchop', 'Cable woodchop', 'core', 'cable', 'wr', { side: true, src: 'Standing Cable Wood Chop', setup: 'Trolley at the top, D-handle, standing side-on.' }),
  x('pallof_press', 'Pallof press', 'core', 'cable', 'wr', { side: true, src: 'Pallof Press', setup: 'Trolley at chest height, D-handle, standing side-on.' }),
  x('cable_crunch', 'Cable crunch', 'core', 'cable', 'wr', { src: 'Cable Crunch', setup: 'Trolley at the top, rope attachment, kneeling facing the machine.' }),
  x('weighted_situp', 'Weighted sit-up', 'core', 'dumbbell', 'wr', { src: 'Sit-Up', setup: 'Hold a dumbbell against your chest. Hook your feet under the low row foot tube.' }),
  x('reverse_crunch', 'Reverse crunch', 'core', 'bodyweight', 'bw', { src: 'Reverse Crunch' }),
  x('suitcase_carry', 'Suitcase carry', 'core', 'dumbbell', 'carry', { side: true, steps: ['Hold one heavy dumbbell at your side like a suitcase.', 'Walk slowly without leaning toward or away from the weight.', 'Switch hands and repeat.'] }),
  x('side_plank', 'Side plank', 'core', 'bodyweight', 'time', { side: true, steps: ['Lie on your side with your forearm under your shoulder and feet stacked.', 'Lift your hips until your body is a straight line.', 'Hold, then switch sides.'] }),
  x('db_side_bend', 'Dumbbell side bend', 'core', 'dumbbell', 'wr', { side: true, src: 'Dumbbell Side Bend' }),
]
