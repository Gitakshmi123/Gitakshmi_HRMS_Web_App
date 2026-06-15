const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.jwt');
const validate = require('../middleware/validation.middleware');
const gradeController = require('../controllers/grade.controller');
const {
  createGradeSchema,
  updateGradeSchema,
  gradeIdSchema,
  listGradesSchema,
} = require('../validations/grade.validation');

router.get('/', auth.authenticate, validate(listGradesSchema), gradeController.getGrades);
router.get('/:id', auth.authenticate, validate(gradeIdSchema), gradeController.getGradeById);
router.post('/', auth.authenticate, auth.requireHr, validate(createGradeSchema), gradeController.createGrade);
router.put('/:id', auth.authenticate, auth.requireHr, validate(updateGradeSchema), gradeController.updateGrade);
router.patch('/:id/status', auth.authenticate, auth.requireHr, validate(gradeIdSchema), gradeController.toggleGradeStatus);
router.delete('/:id', auth.authenticate, auth.requireHr, validate(gradeIdSchema), gradeController.deleteGrade);

module.exports = router;
