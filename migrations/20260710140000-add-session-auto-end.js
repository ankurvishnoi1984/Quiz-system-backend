'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sessions', 'auto_end_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'scheduled_time',
    })
    await queryInterface.addColumn('sessions', 'auto_end_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      after: 'auto_end_enabled',
    })
    await queryInterface.addColumn('sessions', 'auto_end_time', {
      type: Sequelize.STRING(5),
      allowNull: true,
      after: 'auto_end_date',
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('sessions', 'auto_end_time')
    await queryInterface.removeColumn('sessions', 'auto_end_date')
    await queryInterface.removeColumn('sessions', 'auto_end_enabled')
  },
}
