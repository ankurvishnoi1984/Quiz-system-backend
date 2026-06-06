'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sessions', 'scheduled_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      after: 'description',
    })
    await queryInterface.addColumn('sessions', 'scheduled_time', {
      type: Sequelize.STRING(5),
      allowNull: true,
      after: 'scheduled_date',
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('sessions', 'scheduled_time')
    await queryInterface.removeColumn('sessions', 'scheduled_date')
  },
}
