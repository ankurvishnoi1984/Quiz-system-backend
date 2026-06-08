-- Required for survey/quiz multi-select (one response row per selected option).
ALTER TABLE responses DROP INDEX uq_question_participant;
